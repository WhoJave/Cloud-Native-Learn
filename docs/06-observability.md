# 06 · 可观测性：Metrics、Logs、Traces 与 SLO

<div class="chapter-meta"><span>Prometheus</span><span>OpenTelemetry</span><span>Loki</span><span>Tempo</span><span>SLO</span></div>

> Monitoring 更像“看已知指标”，Observability 更进一步：当你不知道问题在哪里时，仍能根据系统输出反推出内部状态。

## 1. 三大支柱

- **Metrics**：哪里不正常。
- **Logs**：具体发生了什么。
- **Traces**：一次请求经过哪里、慢在哪一跳。

现代体系还常加入 **Profiles**，定位进程 CPU/内存热点。

## 2. Prometheus 与 Pull 模型

应用暴露：

```text
GET /metrics
```

Prometheus 周期性 Scrape。

Pull 的好处包括：

- 采集频率统一控制。
- 抓不到目标本身就是健康信号。
- 与 Kubernetes 动态服务发现天然契合。

## 3. Counter / Gauge / Histogram

**Counter**：只增不减，例如请求总数、错误总数。通常结合 `rate()` 看 QPS。

**Gauge**：可升可降，例如内存、连接数、队列长度。

**Histogram**：统计延迟/大小分布，用 Bucket 支撑 P95/P99。

## 4. 为什么不要迷信平均值

99 个请求 100ms，1 个请求 10s，平均值看起来仍可能不高。

因此生产系统更关注：

- P50。
- P95。
- P99。
- P999。
- Tail Latency。

## 5. RED 与 USE

服务优先看 RED：

```text
Rate
Errors
Duration
```

基础资源优先看 USE：

```text
Utilization
Saturation
Errors
```

其中 Saturation 常比单纯 CPU 使用率更有价值，例如数据库连接池等待、IO Queue、Kafka Lag。

## 6. Golden Signals

Google SRE 经典四个黄金信号：

```text
Latency
Traffic
Errors
Saturation
```

不知道该监控什么时，先把这四类做好。

## 7. 集中式日志

Kubernetes 中 Pod 会漂移和重建，因此不能依赖 SSH 某台服务器 `tail -f`。

推荐应用输出 stdout/stderr，再由 Node 级 Agent（Fluent Bit、Vector、Filebeat 等）集中采集。

### ELK 与 Loki

ELK：Elasticsearch + Logstash + Kibana，全文检索和复杂查询强。  
Loki：更强调 Label 索引，日志正文不做同等级全文索引，适合 Kubernetes 日志和成本敏感场景。

## 8. Structured Logging

比起：

```text
申请失败了 xxx
```

更推荐：

```json
{
  "level":"error",
  "service":"credit-service",
  "traceId":"abc123",
  "errorCode":"RISK_TIMEOUT",
  "latencyMs":1200
}
```

金融系统必须对身份证、银行卡、手机号、Token 等数据做脱敏和访问控制。

## 9. Trace / Span

一次请求 = Trace。  
一次具体操作 = Span。

```text
Trace abc123
Gateway          2200ms
└─ Credit        2100ms
   ├─ Redis          4ms
   ├─ Risk        1800ms
   │  └─ DB       1500ms
   └─ CreditDB      80ms
```

不再靠猜，就能看到慢在哪。

## 10. Context Propagation

Trace ID 必须跨：

- HTTP Header。
- gRPC Metadata。
- Kafka Message Header。

持续传播，否则异步链路会“断链”。

## 11. OpenTelemetry

OpenTelemetry 提供统一 API、SDK、数据模型和协议，减少对单一厂商的锁定。

```text
Application
→ OTel SDK
→ OTLP
→ OTel Collector
→ Prometheus / Tempo / Jaeger / Vendor
```

Collector 可做 Batch、Sampling、过滤、脱敏、重试和协议转换。

## 12. Sampling

全量 Trace 成本可能巨大。

Head Sampling：请求开始就决定是否采样，简单但可能漏掉异常。  
Tail Sampling：请求结束后根据错误、延迟等决定保留，更适合生产异常分析。

## 13. Metrics → Trace → Logs

理想排障闭环：

```text
Metric 告警：P99 > 2s
→ 打开异常 Trace
→ 找到 Risk DB Span
→ 通过 traceId 查询日志
→ 定位连接池耗尽
```

Exemplar 可以让指标图上的数据点直接关联到具体 Trace。

## 14. SLI / SLO / SLA

- SLI：实际观测到的服务指标。
- SLO：内部可靠性目标。
- SLA：对客户/业务的外部承诺。

例如一个月 99.9% 可用性大约允许四十多分钟不可用。每增加一个 9，成本都会显著提高。

## 15. Error Budget

SLO=99.9%，意味着允许 0.1% 失败，这就是 Error Budget。

预算消耗过快时应减少高风险发布、优先修稳定性；预算充足时团队可更积极创新。

Burn Rate 衡量的是预算“烧得多快”。

## 16. 一个 8 秒故障如何定位

用户反馈额度申请由 500ms 变成 8s：

```text
Gateway P99 = 8.2s
↓ Trace
Credit = 8.0s
↓
Risk = 7.7s
↓
Risk PostgreSQL = 7.4s
↓ Metrics
DB Connection Pool active=100 / waiting=420
↓ Logs
Long transaction / Lock wait
```

根因链：

```text
长事务
→ DB锁等待
→ SQL慢
→ 连接池耗尽
→ Risk慢
→ Credit P99 8s
```

CPU 只有 30% 也完全可能发生，因为系统在等待锁/连接/IO。

## 17. 关键组件要看什么

Kubernetes：Pod Restart、Pending、OOMKilled、Node Ready、API Server latency。  
Database：TPS、Slow Query、Lock Wait、Connection Wait、Replication Lag。  
Redis：Hit Rate、Eviction、Latency、Blocked Clients、Memory。  
Kafka：Throughput、Consumer Lag、Under Replicated Partitions。

## 18. Cardinality

Metrics Label 不应放 userId、requestId、orderId 等几乎无限值，否则 Time Series 数量会爆炸。

低基数维度适合 Metrics；唯一上下文更适合 Logs/Traces。

## 19. 一套典型现代栈

```text
Instrumentation → OpenTelemetry
Metrics         → Prometheus
Logs            → Loki
Traces          → Tempo
Visualization   → Grafana
Alerting        → Alertmanager
```

规模继续增大后，可引入 Thanos、Mimir、VictoriaMetrics 等解决长期存储、多集群和水平扩展。
