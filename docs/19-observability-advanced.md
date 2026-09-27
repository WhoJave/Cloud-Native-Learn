# 19 · 可观测性高级：Alertmanager、Exemplar、Profiling、Kubernetes Events 与成本治理

<div class="chapter-meta"><span>Alerting</span><span>Exemplar</span><span>Profiling</span><span>Events</span><span>Cardinality</span></div>

## 1. Alert 不应该等于“CPU > 80%”

CPU 高不一定影响用户。

更应优先告警用户症状：

~~~text
Availability ↓
Error Rate ↑
P99 ↑
业务成功率 ↓
~~~

再用基础资源指标解释原因。

## 2. Alertmanager

负责：

- Grouping。
- Deduplication。
- Routing。
- Inhibition。
- Silence。

没有这些机制很容易发生告警风暴。

## 3. 告警风暴

Node 故障可能派生：

~~~text
NodeDown
PodDown x100
ServiceError x20
DBTimeout x10
~~~

应识别根因级告警并抑制派生噪声。

## 4. Symptom vs Cause

Symptom：用户请求失败。  
Cause：DB CPU 95%。

更适合 Pager 的通常是 Symptom，因为 Cause 高并不一定真的影响用户。

## 5. Exemplar

Histogram 某个样本附带 Trace ID：

~~~text
P99 spike
→ exemplar traceId=abc
→ click
→ Tempo Trace
~~~

实现 Metrics → Trace 直达。

## 6. Head / Tail Sampling

Head Sampling：请求开始就决定，简单但可能漏异常。

Tail Sampling：请求结束后看 error、latency、业务重要性再决定，异常保留率高，但 Collector 成本更高。

## 7. Kafka Trace Context

HTTP 用 traceparent；Kafka 通过 Message Headers 传播 Context。

Consumer 取出 Parent Context 再创建 Span，否则异步链会断开。

## 8. Log Correlation

日志建议带：

~~~text
traceId
spanId
requestId
service
env
errorCode
businessId(脱敏)
~~~

便于 Trace ↔ Logs 关联。

## 9. Kubernetes Events

典型：

- FailedScheduling。
- FailedMount。
- BackOff。
- Unhealthy。
- OOMKilled。
- Evicted。

Pod Pending/Restart 时，Event 往往比应用日志更有价值。

## 10. OOMKilled

~~~text
memory limit=1Gi
process usage>1Gi
→ cgroup OOM
→ process killed
→ restart
~~~

还要区分 Node OOM、Container Limit OOM、JVM Heap OOM、Native Memory。

## 11. CPU Throttling

有 CPU Limit 时，即使 Node 还有空闲 CPU，容器超过 CFS quota 也可能被 throttle。

症状可能是 CPU 看着不满但 P99 升高，因此要看 throttled 指标。

## 12. Continuous Profiling

Trace 回答“哪个服务慢”；Profile 回答“哪个函数耗 CPU/内存”。

例如：

~~~text
risk-service CPU高
→ profile
→ 65% 在 ruleEngine.evaluate()
~~~

## 13. Flame Graph

横向宽度表示资源占用/样本比例，纵向是调用栈。

越宽的函数越值得优先分析。

## 14. eBPF Observability

无侵入观测：

- TCP connect latency。
- DNS latency。
- Retransmission。
- Network Drop。
- Syscall。
- Process behavior。

Cilium Hubble 是网络观测典型例子。

## 15. High Cardinality

危险 Label：

~~~text
userId
requestId
orderId
traceId
~~~

低基数维度才更适合 Metrics。

唯一上下文交给 Logs/Traces。

## 16. Histogram Bucket

Bucket 应围绕业务阈值设计，不是越多越好。

例如 SLO 关注 100ms/300ms/500ms/1s，就应让桶能有效回答这些阈值。

## 17. Prometheus 单机局限

随着 Cluster、Retention、Series 增长，会遇到长期存储与横向扩展问题。

常见方案：

- Thanos。
- Mimir。
- VictoriaMetrics。

## 18. Thanos

~~~text
Prometheus
→ Sidecar
→ Object Storage
→ Thanos Query
~~~

适合多 Prometheus、长期历史数据和统一查询。

## 19. 可观测成本

治理包括：

- Sampling。
- Retention 分级。
- DEBUG 短保留。
- Cardinality Budget。
- 冷热分层。
- 日志字段白名单。

## 20. Observability Driven Development

新服务上线前就定义：

~~~text
SLI
Dashboard
Alert
Trace
Structured Log
Runbook
~~~

而不是事故后才补监控。
