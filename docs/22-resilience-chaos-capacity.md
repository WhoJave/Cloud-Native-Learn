# 22 · 高可用、容量规划与 Chaos Engineering

<div class="chapter-meta"><span>HA</span><span>Capacity</span><span>Chaos</span><span>Load Test</span><span>GameDay</span></div>

## 1. 高可用不是“多副本”三个字

高可用需要从整条依赖链看：

~~~text
DNS
→ CDN/WAF
→ LB
→ Gateway
→ Service
→ Pods
→ Redis
→ DB
→ Kafka
→ External API
~~~

任何单点都可能成为瓶颈或故障源。

## 2. Availability 与 Reliability

Availability 更偏：

> 某段时间里服务可被使用的比例。

Reliability 更偏：

> 服务在一段时间内持续正确工作的能力。

高 Availability 不代表每次返回都正确；快速返回错误数据也不是可靠。

## 3. 单点故障 SPOF

常见隐藏单点：

- 单个 NAT Gateway。
- 单 AZ 数据库。
- 单 Redis Primary 且无故障转移。
- 单个 CI Runner。
- 单 Registry。
- 单 DNS Provider。
- 单证书/密钥系统。

画架构图时要主动找“只有一个”的节点。

## 4. Zone Failure

3 个 Pod 如果全在一个 Zone：

~~~text
Zone A
├ Pod1
├ Pod2
└ Pod3
~~~

副本数看起来是 3，但 Zone A 故障仍全部消失。

因此要结合 TopologySpread / Multi-AZ Node Pool。

## 5. Dependency Availability

同步调用链：

~~~text
A → B → C → D
~~~

每个服务 99.9% 可用，整体同步成功概率会继续下降。

因此关键链路要：

- 缩短同步依赖。
- 降低非关键依赖。
- 异步化。
- 设计降级。

## 6. Capacity Planning

不能只看当前平均 QPS。

至少考虑：

- 正常平均。
- P95/P99 峰值。
- 活动峰值。
- 故障转移流量。
- 一个 Zone 下线后的剩余容量。
- 发布时双版本并存。
- Batch/离线任务。

## 7. N+1 / N+2 思想

如果正常需要 10 台 Node 才刚好跑满：

> 任意一台故障就没有余量。

应预留故障容量。

例如关键系统可能要求：

~~~text
正常只使用 60~70%
~~~

让剩余空间承担波动和故障。

## 8. Autoscaling 不是容量规划替代品

扩 Node 需要时间：

~~~text
发现Pending
→ Cloud API
→ VM Boot
→ kubelet Join
→ Image Pull
→ Pod Ready
~~~

可能几十秒到数分钟。

突发流量在新容量到达前仍需：

- Buffer。
- Rate Limit。
- Queue。
- Warm Pool。
- 预扩容。

## 9. Load Test

至少区分：

- Baseline Test。
- Stress Test。
- Spike Test。
- Soak Test。
- Capacity Test。

压测目标不是单纯“跑到多少 QPS”，而是找到：

- 首个瓶颈。
- 饱和点。
- 错误模式。
- 恢复能力。

## 10. 压测必须看下游

API QPS 增长时同时观察：

~~~text
DB Connections
Redis Hit Rate
Kafka Lag
Thread Pool Queue
GC
CPU Throttle
Disk IO
~~~

否则只看 HTTP TPS 很容易误判。

## 11. Backpressure

当下游处理能力不足时，上游不能无限继续灌入。

方式：

- Queue。
- Bounded Buffer。
- Producer Slowdown。
- 429。
- Semaphore。
- Consumer Lag Threshold。

Backpressure 是稳定系统的重要机制。

## 12. Load Shedding

容量已经耗尽时，主动拒绝低价值流量。

例如优先保证：

~~~text
登录
还款
核心交易
~~~

降级：

~~~text
推荐
营销
复杂报表
~~~

## 13. Chaos Engineering 是什么

不是“随机搞挂生产”。

它是：

> 用可控实验验证系统对已知故障假设是否真的有韧性。

## 14. Chaos 实验结构

一个成熟实验至少写清：

~~~text
Steady State
→ Hypothesis
→ Fault Injection
→ Observe
→ Abort Condition
→ Result
~~~

例如：

> 随机杀掉一个 Credit Pod，额度申请成功率仍应保持 SLO。

## 15. Pod Kill

最基础实验：

~~~text
kill one pod
~~~

验证：

- Readiness 是否及时摘除。
- ReplicaSet 是否补副本。
- 用户是否看到错误。
- Trace 是否完整。
- 告警是否正确。

## 16. Node Failure

验证：

- Pod 重新调度。
- PDB 行为。
- Stateful Volume Reattach。
- Zone Capacity。
- LB Health Check。

## 17. Network Chaos

注入：

- Latency。
- Packet Loss。
- Connection Reset。
- DNS Failure。
- Partition。

验证 Timeout/Retry/Circuit Breaker 是否合理。

## 18. Dependency Failure

模拟：

~~~text
Redis unavailable
Kafka unavailable
External API timeout
DB read-only
~~~

观察核心业务是否按预期降级，而不是整体雪崩。

## 19. GameDay

GameDay 是跨团队的故障演练。

例如：

~~~text
Region A失效
→ 谁宣布灾难？
→ 谁切流量？
→ 数据如何恢复？
→ 业务如何验证？
→ 谁对外沟通？
~~~

技术方案没有演练过，就不能算真正的灾备能力。

## 20. Runbook

每个关键告警应对应：

- 影响。
- 首先检查什么。
- 常见原因。
- 安全缓解动作。
- 回滚方式。
- 升级联系人。

减少事故时临场猜测。

## 21. Postmortem

事故后重点不是找人背锅，而是回答：

- 为什么系统允许事故发生？
- 为什么没有更早发现？
- 为什么防护没有生效？
- 如何避免同类故障？

输出 Action Items，并真正跟踪完成。

## 22. Error Budget 与发布节奏

如果错误预算接近耗尽：

~~~text
减少高风险发布
→ 优先可靠性修复
~~~

如果预算充足：

~~~text
可以更积极创新
~~~

这让可靠性不再是“永远越高越好”的抽象口号。
