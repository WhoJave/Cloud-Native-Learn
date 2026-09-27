# 16 · Redis 深潜：为什么快、缓存、幂等、分布式锁与生产风险

<div class="chapter-meta"><span>Memory</span><span>Cache</span><span>NX/EX</span><span>Lock</span><span>Hot Key</span></div>

## 1. Redis 为什么快

不能只回答“因为在内存”。

主要因素包括：

- 内存访问，避免多数磁盘随机 IO。
- 高效数据结构。
- 核心命令执行模型简单，减少共享状态锁竞争。
- 高效事件循环与网络 IO。
- Pipeline / 批处理减少 RTT。
- 数据结构针对常见场景优化。

“单线程”也不能简单理解成 Redis 所有工作永远只有一个线程，现代 Redis 在网络 IO、后台任务等方面可以使用多线程；关键是核心命令执行的一致性模型长期保持简单。

## 2. 常见数据结构

String：缓存、验证码、计数器、锁 Token。  
Hash：对象字段。  
List：简单队列/列表。  
Set：去重集合。  
Sorted Set：排行榜、延迟调度的某些实现。  
Bitmap：状态位统计。  
HyperLogLog：近似基数。  
Stream：消息流。

选择数据结构要根据访问模式，而不是“所有数据都 String + JSON”。

## 3. Cache Aside

读：

```text
App
→ Redis
→ Hit: 返回

Miss:
→ DB
→ 回填 Redis
→ 返回
```

写：

```text
Update DB
→ Delete Cache
```

之所以常删除而不是直接更新，是为了降低并发顺序错误。

## 4. 为什么 Cache 不是权威数据源

缓存应该允许：

```text
丢失
失效
重建
```

核心业务真相通常在数据库/事件日志。

如果应用无法在 Redis 全部清空后恢复，就要重新评估 Redis 承担的是“缓存”还是“主存储”。

## 5. TTL

TTL 用于避免数据无限保留，但 TTL 不是越短越好。

过短：

- 命中率低。
- DB 压力大。

过长：

- 陈旧数据风险高。
- 内存占用大。

应根据业务变更频率和可接受陈旧时间设计。

## 6. 缓存穿透

查询永远不存在的 Key：

```text
Redis Miss
→ DB Miss
→ 每次都打DB
```

手段：

- 参数校验。
- 缓存空值。
- Bloom Filter。

## 7. Bloom Filter

用多个 Hash 位判断“可能存在/一定不存在”。

特点：

- False Positive 可能存在。
- False Negative 通常不应存在。

适合在大量非法 Key 到 DB 之前做第一道过滤。

## 8. 缓存击穿

某个超级热点 Key 过期：

```text
瞬间大量请求
→ 全部 Miss
→ DB 被打爆
```

手段：

- 互斥重建。
- 逻辑过期。
- 提前刷新。
- 热点 Key 特殊 TTL。

## 9. 缓存雪崩

大量 Key 在接近时间同时失效。

手段：

- TTL 加随机抖动。
- 多级缓存。
- 限流。
- 预热。
- 降级。
- DB 容量保护。

## 10. Hot Key

某单一 Key 的访问量远高于平均值，会把某个 Redis Shard、Network 或 CPU 打满。

可以考虑：

- 本地缓存。
- Key 拆分。
- 多副本读。
- 请求合并。
- 热点识别。

## 11. Big Key

单 Key 存储巨大对象/集合会造成：

- 网络阻塞。
- 删除卡顿。
- 主从复制压力。
- Cluster Slot 迁移困难。

不要把“大对象”简单塞 Redis。

## 12. 验证码

典型：

```text
SET verify:phone:xxx code EX 300
```

还需要考虑：

- 发送频率限制。
- 错误次数。
- 验证后删除。
- 防暴力猜测。
- 手机号脱敏。

## 13. 短时间重复申请防护

例如：

```text
SET credit:apply:user123 token NX EX 10
```

NX：Key 不存在才成功。  
EX：自动过期。

这可以减少用户连续点击带来的重复流量。

但对于“最终只能创建一笔业务记录”，仍应该由业务幂等/DB 唯一约束兜底。

## 14. 基础分布式锁

获取：

```text
SET lock:key random-token NX PX 30000
```

释放时不能直接 DEL：

必须确认 Value 仍是自己的 Token，再删除，通常用 Lua 保证检查+删除原子性。

否则锁过期后被别人重新获取，旧客户端醒来可能误删别人的锁。

## 15. 锁过期问题

Client A 获锁 30s。

因为：

- Full GC。
- 网络暂停。
- STW。
- 机器卡顿。

业务执行超过 30s，锁已经自动过期。

Client B 此时拿到锁。

A 恢复后继续执行。

结果：

```text
A和B同时认为自己有权写
```

所以分布式锁不是“加了就绝对互斥”。

## 16. Watchdog / Lock Renewal

某些客户端会在持锁期间周期续租。

可以降低业务正常执行超过 TTL 的风险。

但如果发生网络分区、进程暂停等复杂故障，仍需结合业务幂等和 Fence Token 等更强机制思考。

## 17. Fencing Token

每次获得锁时得到单调递增 Token：

```text
Lock 101
Lock 102
Lock 103
```

下游存储拒绝比当前 Token 更旧的写入。

即使旧持锁者恢复，也因为 Token 过期而无法覆盖新写。

这比仅靠“Redis Key 还在不在”更强。

## 18. Redlock 为什么有争议

多 Redis 实例的锁算法涉及对时钟、网络分区、故障模型等假设。

工程上不要简单认为：

> “用了 Redlock = 所有分布式互斥问题都严格解决”。

金融核心一致性场景更应优先依靠数据库事务、唯一约束、状态机、共识存储等明确语义。

## 19. Redis 限流

常见实现：

- INCR + EXPIRE。
- Sliding Window ZSET。
- Token Bucket Lua。
- Leaky Bucket。

需要确保原子性和时间窗口语义。

## 20. Redis 持久化

RDB：周期快照。  
AOF：记录写命令。  
可组合使用。

但 Redis 做缓存时，应优先假定可以丢并从源重建；如果承担关键数据，则必须认真设计持久化、复制、故障切换。

## 21. Replica / Sentinel / Cluster

Replica：主从复制。  
Sentinel：监控、故障转移、主节点发现。  
Cluster：分片 + 高可用，Key 映射到 Hash Slot。

Cluster 并不自动解决跨 Key 强事务语义。

## 22. Redis 与 Kubernetes

可选择：

- 云托管 Redis。
- Operator。
- StatefulSet。

生产要考虑：

- 持久化需求。
- 主从故障转移。
- Anti-Affinity。
- PDB。
- Volume。
- 网络延迟。
- 备份。

对于金融核心场景，托管 Redis 往往能显著减少运维复杂度。
