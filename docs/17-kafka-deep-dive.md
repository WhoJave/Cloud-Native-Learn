# 17 · Kafka 深潜：Partition、复制、ACK、消费语义、顺序、积压与 Exactly-Once

<div class="chapter-meta"><span>Partition</span><span>Replication</span><span>acks</span><span>Consumer Group</span><span>Lag</span></div>

## 1. Kafka 不是普通“队列”

Kafka 更接近：**分区、可复制、可持久化、可重放的追加日志系统**。

~~~text
Topic: credit.approved
├─ Partition 0
├─ Partition 1
└─ Partition 2
~~~

每个 Partition 内部是有序 append-only log。

## 2. Offset

Partition 中每条记录有位置：

~~~text
offset 0
offset 1
offset 2
...
~~~

Consumer 不会“把消息从 Kafka 删除”，而是记录自己消费到哪个 Offset。因此同一份数据可以被多个 Consumer Group 独立重放。

## 3. Consumer Group

同一 Group 内，一个 Partition 同时只分配给一个 Consumer。

~~~text
3 Partitions + 3 Consumers
→ 3个并行处理

3 Partitions + 10 Consumers
→ 至少7个消费者空闲
~~~

因此消费并行度上限与 Partition 数有关。

## 4. Partition Key

Producer 指定：

~~~text
key=userId
~~~

相同 Key 通常映射到同一 Partition，因此同一用户事件可保持顺序：

~~~text
CreditApproved
→ LoanCreated
→ RepaymentCompleted
~~~

不同 Partition 之间没有全局顺序。

## 5. Leader / Follower

每个 Partition 可以有多个副本。

~~~text
Partition 0
Leader   Broker1
Follower Broker2
Follower Broker3
~~~

Producer/Consumer 通常与 Leader 交互，Follower 复制数据。Leader 故障后，从合适副本中选新 Leader。

## 6. Replication Factor

Replication Factor=3 表示同一 Partition 有三份副本。

它提高 Broker 故障容忍能力，但也增加磁盘与网络复制开销，并不能代替跨 Region 灾备。

## 7. ISR

ISR（In-Sync Replicas）表示与 Leader 保持足够同步的副本集合。

Follower 长期跟不上会离开 ISR。Leader 选举与 ISR 直接影响数据安全。

## 8. acks

### acks=0
Producer 不等待确认，吞吐高，但丢失风险最大。

### acks=1
Leader 写入成功就确认。Leader 确认后、Follower 尚未复制时若 Leader 故障，可能丢数据。

### acks=all
等待满足条件的同步副本确认，可靠性更高。

但必须和 min.insync.replicas 一起理解。

## 9. min.insync.replicas

例如：

~~~text
RF=3
min.insync.replicas=2
acks=all
~~~

至少两个同步副本才能正常完成写确认。如果只剩一个 ISR，系统宁愿拒绝写，也不继续冒险。

这就是一致性与可用性的现实权衡。

## 10. Producer Retry 与幂等 Producer

网络抖动时 Retry 可能让同一条消息重复到达 Broker。

Kafka 的 Idempotent Producer 通过 Producer ID / Sequence 等机制降低重试造成的重复写入，但这不等于“外部数据库业务恰好执行一次”。

## 11. At-most-once

一种处理方式：

~~~text
先提交Offset
→ 再处理业务
~~~

如果处理前宕机，消息不会再投，但业务可能没执行。

特征：**可能丢，不易重复。**

## 12. At-least-once

更常见：

~~~text
处理业务
→ 成功
→ 提交Offset
~~~

如果业务成功后、Offset 提交前宕机，重启后会再次收到。

特征：**不轻易丢，可能重复。**

## 13. Exactly-once 为什么难

端到端业务往往涉及：

~~~text
Kafka
+ Database
+ External API
+ Cache
~~~

即使 Kafka 内部某些路径提供 EOS，仍可能出现：

~~~text
DB写成功
Offset提交失败
→ 消息重投
~~~

所以“Kafka 支持 Exactly Once”不能直接等价于“业务只执行一次”。

## 14. Kafka Transaction

Kafka Transaction 适合把 Kafka 内部的：

- 多 Partition 写入。
- Consume-Transform-Produce。
- Offset Commit。

放在一个 Kafka 事务边界中。

它不能天然把外部 MySQL 事务一起包进去。

## 15. Outbox + Kafka

业务数据库事务：

~~~text
BEGIN
更新业务表
写 outbox
COMMIT
~~~

Publisher：

~~~text
读取 outbox
→ Kafka
→ 标记发送
~~~

即使重复发，也由 Consumer 幂等处理。

## 16. Consumer 幂等

事件：

~~~text
eventId=evt-123
~~~

消费时可使用：

- 唯一约束。
- Inbox Table。
- processed_event 表。
- 业务状态机。
- Version。

不要只用内存 Set，否则 Consumer 重启后去重状态会丢失。

## 17. 消息乱序

即使同业务 Key 应该进入同 Partition，也可能因为多 Topic、多 Producer、Retry、跨系统同步造成逻辑乱序。

常见保护：

~~~text
eventVersion
sequence
state machine
~~~

例如当前 version=10，就拒绝 version=9 的旧事件覆盖新状态。

## 18. Rebalance

Consumer Group 成员变化时，Partition 会重新分配。

常见触发：

- Consumer 新增/退出。
- Session Timeout。
- Topic Partition 变化。

Rebalance 期间可能暂停消费，因此长耗时业务要正确配置 Poll/Heartbeat。

## 19. Consumer Lag

~~~text
Latest Offset - Committed Offset = Lag
~~~

Lag 持续上升说明消费者追不上生产速度。

原因可能是：

- Consumer 少。
- Partition 少。
- DB 慢。
- 下游 API 慢。
- 单消息处理太重。
- GC。
- Rebalance 频繁。

不能只看 CPU。

## 20. Backpressure

Producer 10000 msg/s，Consumer 5000 msg/s：

~~~text
Lag持续增长
~~~

Kafka 能缓冲，但不是无限容量。需要考虑：

- 最大可接受 Lag。
- Retention。
- 磁盘。
- 扩 Consumer。
- 限流入口。
- 业务降级。

## 21. Retention

Kafka 消息通常不是消费后立即删除，而是按时间/大小保留，因此可以 Replay。

## 22. Log Compaction

按 Key 保留较新的值，适合：

~~~text
userId → latest profile
configKey → latest config
~~~

它与普通时间保留语义不同。

## 23. DLQ

持续失败消息不应无限阻塞主链：

~~~text
main topic
→ retry topic
→ retry N times
→ DLQ
~~~

DLQ 必须配告警、上下文、修复与 Replay 工具。

## 24. 延迟消息

Kafka 原生不是任意延迟队列，但可以通过 Retry Topic、定时扫描、时间轮或其它 MQ 机制实现延迟业务。

## 25. Kafka 在 Kubernetes

重点关注：

- StatefulSet / Operator。
- Broker 身份。
- Persistent Volume。
- Rack/Zone Awareness。
- PodAntiAffinity。
- PDB。
- Rolling Upgrade。
- 磁盘吞吐。
- 网络带宽。

Kafka 性能常首先受磁盘与网络影响，不只是 CPU。

## 26. 什么时候不需要 Kafka

如果只是一个低吞吐、单消费者、无需 Replay 的简单任务流，数据库任务表或更轻量 MQ 可能更合适。

架构目标是匹配问题，而不是“必须 Kafka”。
