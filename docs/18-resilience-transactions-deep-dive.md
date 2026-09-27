# 18 · 可靠性与分布式事务深潜：Timeout Budget、Retry Storm、Bulkhead、TCC、Saga

<div class="chapter-meta"><span>Timeout</span><span>Retry</span><span>Circuit Breaker</span><span>Saga</span><span>TCC</span></div>

## 1. 网络调用不是函数调用

远程调用会经过 DNS、网络、远程进程和远程依赖。任何一跳都可能失败。

最关键的是：

> Timeout 不代表远端一定没执行成功。

## 2. Timeout Budget

假设用户总 SLO 800ms：

~~~text
Gateway → Credit → Risk → External
~~~

不能给每个下游都 800ms。

应按链路分配预算，例如：

~~~text
Gateway overhead 50ms
Credit local    100ms
Risk            400ms
External        150ms
Buffer          100ms
~~~

## 3. 不同 Timeout

至少要区分：

- Connect Timeout。
- TLS Handshake Timeout。
- Read/Request Timeout。
- Idle Timeout。

不同超时对应不同失败阶段。

## 4. Little's Law

近似：

~~~text
并发量 ≈ 到达率 × 平均停留时间
~~~

1000 QPS、平均 100ms：

~~~text
≈100并发
~~~

如果延迟变 5s：

~~~text
≈5000并发
~~~

因此延迟本身就是资源占用。

## 5. Retry Storm

下游已过载：

~~~text
1000 requests
× retry 3
≈ 3000 attempts
~~~

更多 Retry 让下游更慢，形成正反馈雪崩。

正确 Retry 必须：

- 有次数上限。
- 只对可恢复错误。
- Exponential Backoff。
- Jitter。
- 尊重总 Timeout Budget。

## 6. Jitter

10000 个客户端都在 100ms 后重试会形成同步洪峰。

加入随机抖动让重试错峰，避免“惊群”。

## 7. 哪些错误适合 Retry

更适合：

- Connection Reset。
- 短暂 503。
- 部分瞬态网关错误。

通常不应：

- 400 参数错误。
- 401/403。
- 明确业务拒绝。
- 非幂等写操作盲重试。

## 8. Circuit Breaker

~~~text
Closed
→ failure threshold
→ Open
→ cooldown
→ Half-Open
→ success → Closed
→ failure → Open
~~~

作用不是让错误消失，而是停止对明显故障的下游继续施压。

## 9. Fail Fast

在资源有限时：

~~~text
快速返回可解释错误
~~~

通常比：

~~~text
所有线程等待10秒后一起失败
~~~

更健康。

## 10. Bulkhead

将资源隔离：

~~~text
Risk Client Pool
Notification Client Pool
External Data Pool
~~~

一个依赖卡死不应占满所有线程/连接。

## 11. Pool 大小不是越大越好

DB Connection Pool 太大可能把数据库直接压垮；太小又会大量排队。

要根据：

- DB 最大连接。
- 服务实例数。
- QPS。
- Query latency。

综合设计。

## 12. Load Shedding

过载时主动丢弃/拒绝低优先级工作：

- 429。
- 降级推荐。
- 拒绝大查询。
- 暂停非关键任务。

目标是保住核心链路。

## 13. Graceful Degradation

某非核心外部画像服务不可用时，可以在业务允许前提下采用保守降级，但绝不能把强校验偷偷变成默认通过。

## 14. 幂等 Key

同一逻辑业务携带固定 Idempotency-Key，服务端绑定第一次结果。

重复请求返回原结果，不重新执行业务。

## 15. 唯一约束

“同一 requestId 只能生成一笔订单”通常应有数据库 UNIQUE 兜底。

比单纯 Redis Lock 更可靠。

## 16. 状态机

~~~text
INIT
→ APPROVED
→ DISBURSING
→ DISBURSED
~~~

重复/乱序消息必须通过状态转换规则校验。

## 17. 2PC

Prepare → Commit/Rollback。

问题：

- 持锁。
- 阻塞。
- Coordinator 故障。
- 吞吐受限。

不适合作为所有互联网微服务事务的默认解法。

## 18. TCC 额度冻结

当前可用额度 50000，借款 10000。

### Try

~~~text
available=40000
frozen=10000
~~~

### Confirm

~~~text
frozen-=10000
used+=10000
~~~

### Cancel

~~~text
frozen-=10000
available+=10000
~~~

## 19. TCC 空回滚、悬挂和幂等

分布式异常下可能：

- Cancel 先于 Try 到。
- Confirm 重复。
- Try 超时后迟到。

所以 TCC 三类接口自身都必须幂等，并防止空回滚/悬挂。

## 20. Saga

~~~text
T1 → T2 → T3
C1 ← C2 ← C3
~~~

T3 失败后依次执行补偿。

## 21. Compensation ≠ Rollback

数据库 Rollback 表示事务没有落地。

Saga Compensation 是新业务动作，例如先扣款再退款，历史仍存在。

## 22. Choreography

事件链自行协调：

~~~text
LoanCreated
→ CreditReserved
→ PaymentStarted
→ PaymentFailed
→ CreditReleased
~~~

优点是松耦合，缺点是流程分散、难追踪。

## 23. Orchestration

~~~text
Saga Orchestrator
→ ReserveCredit
→ CreateLoan
→ Accounting
→ Compensation
~~~

流程集中，但协调器自身也需要持久化状态与高可用。

## 24. Outbox

~~~text
BEGIN
业务修改
插入 outbox
COMMIT
~~~

解决本地 DB 状态与“待发事件”之间的原子性。

## 25. Inbox

Consumer 侧可把：

~~~text
业务写
+
inbox(eventId)
~~~

放进同一本地事务，用唯一 eventId 防重复。

## 26. 最终一致不是“不管一致性”

成熟最终一致系统必须具备：

- 状态机。
- Retry。
- 幂等。
- 补偿。
- 对账。
- 告警。
- 人工修复路径。

“最终一致”是工程体系，不是一句口号。
