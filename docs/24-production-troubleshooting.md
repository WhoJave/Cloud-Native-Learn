# 24 · 生产排障全景 Runbook：从“用户说慢”到根因

<div class="chapter-meta"><span>Runbook</span><span>Network</span><span>Scheduling</span><span>Storage</span><span>DB</span></div>

## 1. 第一原则：先确认用户症状

不要上来就 SSH / Restart。

先回答：

~~~text
影响哪个功能？
多少用户？
从什么时候开始？
全部请求还是P99？
哪个Region/Cluster？
是否和发布相关？
~~~

## 2. 从 SLI 开始

先看：

- Success Rate。
- P95/P99。
- QPS。
- Business Success Rate。

确认是否真有生产影响。

## 3. 再看最近变更

高价值问题：

~~~text
刚发布了吗？
Config改了吗？
Feature Flag改了吗？
流量突增了吗？
依赖方变了吗？
证书/Secret轮换了吗？
~~~

大量事故与 Change 强相关。

## 4. Trace 定位哪一跳

~~~text
Gateway 8s
└ Credit 7.9s
  └ Risk 7.5s
    └ DB 7.2s
~~~

先缩小服务边界，再深入资源。

## 5. Pod CrashLoopBackOff

检查：

~~~text
kubectl describe pod
kubectl logs --previous
~~~

常见：

- 启动参数错误。
- Secret/Config 缺失。
- 端口冲突。
- OOM。
- Probe 配错。
- 依赖不可用。

BackOff 是结果，不是根因。

## 6. Pod Pending

优先看 Event：

- Insufficient CPU/Memory。
- Taint。
- Affinity。
- PVC。
- Zone。
- Max Pod/IP。
- Image Pull Secret 不属于 Scheduling，但会在后续阶段卡住。

## 7. ImagePullBackOff

排查：

- Image Tag/Digest 存在吗。
- Registry Auth。
- DNS。
- Registry 网络。
- Rate Limit。
- Architecture amd64/arm64。

## 8. OOMKilled

确认：

- Limit。
- Working Set。
- JVM Heap。
- Native Memory。
- Leak。
- 突发大对象。

不要只“把 Limit 加大”而不分析趋势。

## 9. CPU 高

进一步判断：

- 真计算负载。
- GC。
- Busy Loop。
- 加密压缩。
- 序列化。
- Sidecar。
- Throttle。

Profile 比猜更可靠。

## 10. CPU 不高但服务慢

优先考虑等待：

- DB Lock。
- Connection Pool。
- Thread Pool。
- Network。
- Disk IO。
- External API。
- Queue。

低 CPU 完全可以高延迟。

## 11. Service 无法访问

逐层：

~~~text
App process/listen
→ Pod Ready
→ Pod IP
→ EndpointSlice
→ Service IP
→ DNS
→ Gateway
→ LB
~~~

每层验证一次，避免随机试配置。

## 12. DNS 故障

如果：

~~~text
curl ServiceIP 成功
curl service-name 失败
~~~

重点看：

- /etc/resolv.conf。
- CoreDNS Pod。
- CoreDNS Logs。
- DNS QPS。
- Upstream Resolver。
- NetworkPolicy。

## 13. NetworkPolicy

连接 Timeout 但 Pod/Service 都正常时，确认是否被 Policy Drop。

Cilium/Hubble 等可直接看 flow verdict。

## 14. conntrack

大量短连接场景出现随机新连接失败：

~~~text
nf_conntrack table full
~~~

需检查连接追踪容量和连接模式。

## 15. SNAT Port Exhaustion

大量 Pod 通过少量公网 IP 访问外部服务时，可能耗尽 NAT 端口。

症状：

- 外网连接随机失败。
- 内网正常。
- 增 QPS 后加剧。

这是云网络常见隐藏瓶颈。

## 16. PVC Pending

排查：

- StorageClass 存在。
- CSI Controller 正常。
- Provisioner。
- Quota。
- Zone。
- Access Mode。
- WaitForFirstConsumer。

## 17. FailedMount

检查：

- Volume Attach。
- CSI Node Plugin。
- Node 设备。
- Filesystem。
- Secret。
- Mount Option。

## 18. Multi-Attach

RWO 盘从故障 Node 漂移时旧 Attachment 未释放，新 Node 会挂载失败。

要处理 Storage Attachment，而不是不停重启 Pod。

## 19. DB Connection Pool Exhausted

症状：

~~~text
CPU不高
active=max
waiting持续上升
P99暴涨
~~~

根因可能：

- 慢 SQL。
- 锁等待。
- DB 连接过少。
- Connection Leak。
- 下游事务过长。

## 20. Slow Query

分析：

- Execution Plan。
- Index。
- Rows Scanned。
- Lock。
- IO。
- Statistics。
- Parameter Skew。

“加机器”不一定解决坏 SQL。

## 21. Redis Hit Rate 下跌

可能：

~~~text
Cache Miss↑
→ DB QPS↑
→ DB Latency↑
→ API P99↑
~~~

排查：

- 大量 Key 同时过期。
- Eviction。
- Key Prefix 变化。
- 发布导致 Cache Key 失配。

## 22. Redis Hot Key

单 Shard CPU/Network 高，但 Cluster 总体看着正常。

需要按 Key 分析热点，而不是只看总指标。

## 23. Kafka Lag 上升

依次看：

- Producer Rate 是否突增。
- Consumer 数。
- Partition 数。
- Rebalance。
- DB/API 下游。
- Consumer Error/Retry。
- 单消息耗时。

Lag 是现象，不是根因。

## 24. Gateway 5xx

先区分：

- Gateway 自己错误。
- Upstream Connect Failure。
- Upstream Timeout。
- Upstream 5xx。

不同错误码/日志字段定位方向完全不同。

## 25. 证书事故

TLS Failure 可能来自：

- Cert 过期。
- Hostname 不匹配。
- Intermediate 缺失。
- Time Skew。
- Cipher/TLS Version。
- mTLS Client Cert。

证书过期必须做提前自动告警。

## 26. 发布后故障

最佳动作通常：

~~~text
确认影响
→ 暂停Rollout
→ 关闭Feature Flag或Rollback
→ 恢复用户
→ 再深入根因
~~~

事故处理中恢复服务优先于现场调试。

## 27. 不要随便 Restart

重启可能：

- 暂时掩盖 Memory Leak。
- 清掉现场。
- 引发流量重新分配。
- 让 Stateful 恢复更慢。

除非它是已验证的安全缓解措施。

## 28. 事故证据

保留：

- Metrics 时间点。
- Trace。
- Logs。
- Kubernetes Events。
- Deployment Change。
- Config Diff。
- DB 状态。
- Timeline。

便于 Postmortem。

## 29. 一个统一排障模型

~~~text
用户症状
→ SLI
→ Change
→ Trace
→ Service RED
→ Resource USE
→ Logs / Events
→ Root Cause
→ Mitigation
→ Fix
→ Prevention
~~~

这比“先看 CPU、再重启”可靠得多。
