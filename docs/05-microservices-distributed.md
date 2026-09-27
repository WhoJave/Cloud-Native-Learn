# 05 · 微服务与分布式系统：真正的复杂度从这里开始

<div class="chapter-meta"><span>DDD</span><span>REST/gRPC</span><span>Resilience</span><span>Saga</span><span>Kafka</span><span>Outbox</span></div>

> 微服务不是“服务越小越先进”。它的价值是把业务边界、团队边界、部署边界和扩缩容边界对齐。

## 1. 单体并不落后

小团队、业务早期时，单体通常具有开发快、调试简单、事务容易等优势。

成熟演进往往是：

```text
单体
→ 模块化单体
→ 明确业务边界
→ 只拆热点/高变化模块
→ 微服务
→ 事件驱动
→ 平台化治理
```

## 2. DDD 与 Bounded Context

正确拆分更接近：

```text
User Domain
Credit Domain
Risk Domain
Loan Domain
Repayment Domain
```

而不是按 Controller/DAO/Util 技术层切服务。

理想上，每个服务拥有自己的业务逻辑和数据，不让另一个服务随意直接改它的表。

## 3. Database per Service 的代价

优点：自治、独立演进。  
代价：不能再随便跨库 JOIN，必须通过 API 或 Event 协作。

因此微服务把：

```text
函数调用
```

升级成：

```text
不可靠网络上的分布式调用
```

这就是复杂度爆发点。

## 4. REST vs gRPC

| 维度 | REST | gRPC |
|---|---|---|
| 格式 | JSON | Protobuf |
| 类型约束 | 较弱 | 强 |
| 性能 | 好 | 通常更高 |
| 浏览器/开放 API | 很友好 | 相对复杂 |
| Streaming | 一般 | 强 |
| 典型用途 | 对外 API | 内部 RPC |

规则不是绝对的。

## 5. 网络调用必须默认会失败

可能发生：

- 连接失败。
- DNS 抖动。
- 请求超时。
- 服务重启。
- 服务实际成功，但 Response 丢失。

因此远程调用绝不能像本地函数一样思考。

## 6. Timeout / Retry / Circuit Breaker / Bulkhead

### Timeout
不无限等待。高延迟会持续占用线程、连接和内存。

### Retry
只针对瞬时可恢复错误，使用有限次数 + Exponential Backoff + Jitter。

错误重试会形成 Retry Storm：

```text
服务过载
→ timeout
→ 更多 retry
→ 更过载
```

### Circuit Breaker
失败率过高时进入 Open，快速失败；稍后 Half-Open 探测恢复。

### Bulkhead
像船舱隔板一样隔离资源：线程池、连接池、Pod、Node，避免一个下游拖垮全部业务。

## 7. Rate Limiting

系统承受 5000 QPS 时，不应该硬吃 20000 QPS。

常见算法：

- Fixed Window。
- Sliding Window。
- Token Bucket。
- Leaky Bucket。

限流的目的不是拒绝用户，而是保护整体系统。

## 8. 幂等：金融系统的生命线

“同一操作执行多次，最终结果和执行一次相同”。

创建借款、扣余额天然不幂等，需要显式设计：

- Idempotency-Key。
- 数据库唯一约束。
- 状态机。
- 乐观锁。
- 去重表。

不要看到并发就立刻加 Redis 分布式锁。很多场景唯一约束和状态机更可靠、更简单。

## 9. 乐观锁 / 悲观锁

乐观锁：

```sql
UPDATE credit
SET available = 7000, version = 6
WHERE id = 1 AND version = 5;
```

适合冲突相对少的场景。

悲观锁：

```sql
SELECT ... FOR UPDATE;
```

一致性直观，但降低并发并增加死锁风险。

## 10. CAP 与 BASE

网络分区 P 对真正分布式系统几乎不可避免，因此故障期间往往在一致性 C 和可用性 A 间权衡。

注意 CAP 的 Consistency 与 ACID 中的 C 不是同一个概念。

BASE 强调：

```text
Basically Available
Soft State
Eventually Consistent
```

即允许短暂不一致，最终收敛。

## 11. 分布式事务方案

### 2PC
Prepare → Commit。强一致，但容易阻塞，协调成本高。

### TCC
Try → Confirm / Cancel。业务侵入强，但适合部分关键金融流程。

### Saga
把长事务拆成多个本地事务，每一步配补偿动作。

数据库 Rollback 是“没发生”；Saga Compensation 是“已经发生，再做反向业务操作”。

## 12. Saga 两种风格

Choreography：

```text
Event A → Service B → Event B → Service C
```

松耦合，但流程可能难追踪。

Orchestration：

```text
Saga Orchestrator
→ Credit
→ Loan
→ Accounting
```

流程集中清晰，但引入协调器。

## 13. Kafka 与事件驱动

同步链：

```text
A → B → C
```

事件驱动：

```text
A → Event Bus
    ├→ B
    ├→ C
    └→ D
```

Kafka 价值不仅是“快”，更重要是：

- 解耦。
- 缓冲。
- 削峰。
- 持久化事件。
- 多消费者独立消费。

## 14. Partition / Offset / Consumer Group

Partition 是追加日志；同 Partition 内可以保持顺序。  
Offset 表示 Consumer 读到哪里。  
Consumer Group 让多个 Consumer 并行分摊 Partition。

同一业务实体需要顺序时，可用 userId / orderId 等作为 Key，让相关事件进入同一 Partition。

## 15. Command 与 Event

- Command：请做某件事，例如 CreateLoan。
- Event：某事已经发生，例如 LoanCreated。

Event 最好使用过去式命名，因为它表达事实。

## 16. 双写问题

危险代码：

```text
更新 DB
→ 发送 Kafka
```

可能：

- DB 成功，Kafka 失败。
- Kafka 成功，DB 失败。

这就是 Dual Write Problem。

## 17. Outbox Pattern

在一个本地事务里：

```text
更新业务表
+
插入 outbox_event
→ Commit
```

独立 Publisher 再把 Outbox 可靠发送到 Kafka。

Publisher 可能重复发送，因此现实工程常采用：

> At-least-once + Consumer Idempotency

而不是迷信端到端 Exactly Once。

## 18. 消息可靠性

需要从三段一起设计：

```text
Producer → Broker → Consumer
```

Producer：Outbox / ACK / Retry。  
Broker：Replication / Durability。  
Consumer：处理成功后提交 Offset + 幂等。

重复失败的消息进入 DLQ，避免无限阻塞主消费链。

## 19. 缓存一致性与三类故障

典型 Cache Aside：

```text
读：Cache → Miss → DB → 回填 Cache
写：Update DB → Delete Cache
```

常见问题：

- 缓存穿透：不存在 Key 一直打 DB。
- 缓存击穿：热点 Key 过期瞬间打 DB。
- 缓存雪崩：大量 Key 同时失效。

对应手段包括 Bloom Filter、空值缓存、互斥重建、随机 TTL、限流和预热。

## 20. CQRS / Event Sourcing

CQRS：读写模型分离。  
Event Sourcing：把状态变化记录成事件并可 Replay。

两者经常一起使用，但完全不是一回事。不要为了“高级”而强行引入。

## 21. 同步链不要太长

多个 99.9% 可用服务串成同步链，总体可用性会下降，延迟也会累加。

一般原则：

> 必须立即拿结果 → 同步。  
> 通知、审计、统计等非关键路径 → 异步。

好架构是同步与异步混合，不是“全部微服务化”或“全部事件化”。
