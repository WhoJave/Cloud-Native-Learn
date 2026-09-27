# Cloud Native Learn ☁️

> **V2 完整版 · 25 章**
>
> 一套面向开发者的云原生架构“从零到全貌”学习站点。V2 不再把已讨论的机制压成摘要：在原有 00–11 主线教材基础上，新增 12–24 深度章节，补齐网络逐跳、Informer/WorkQueue、Redis、Kafka、分布式事务、资源治理、Chaos、安全纵深和生产排障。

## 在线站点

**https://whojave.github.io/Cloud-Native-Learn/**

每次 push 到 `main` 后由 GitHub Actions 自动发布 Pages。

## V2 内容地图

### 主线教材

| 章节 | 内容 |
|---|---|
| 00 | 云原生全貌：从物理机、虚拟机到平台工程 |
| 01 | 容器：Namespace、Cgroup、OverlayFS、OCI、containerd、runc |
| 02 | Kubernetes：API Server、etcd、Controller、Scheduler、kubelet、Reconcile |
| 03 | 网络：CNI、veth、VXLAN、BGP、Service、CoreDNS、iptables/IPVS/eBPF、Gateway |
| 04 | 存储：Volume、PV/PVC、StorageClass、CSI、StatefulSet、Ceph/Rook |
| 05 | 微服务与分布式：DDD、REST/gRPC、容错、CAP、Saga、Kafka、Outbox、幂等 |
| 06 | 可观测性：Prometheus、Loki、Tempo、OpenTelemetry、RED/USE、SLO |
| 07 | CI/CD 与 GitOps：Registry、SBOM、签名、Helm、Kustomize、Argo CD、平台工程 |
| 08 | 云原生安全：IAM/RBAC、Secret、Zero Trust、Policy as Code、Runtime Security |
| 09 | 多集群、Serverless、KEDA、弹性与 FinOps |
| 10 | 综合案例：消费金融额度申请端到端云原生链路 |
| 11 | 学习路线与架构师检查清单 |

### V2 深度教材

| 章节 | 深入主题 |
|---|---|
| 12 | DNS、CDN Cache Hit/Miss、WAF、L4/L7 LB、Ingress Controller、Gateway API、真实源 IP |
| 13 | Reflector、DeltaFIFO、Informer、Indexer、WorkQueue、Pod Sandbox、Leader Election、Finalizer |
| 14 | Pod 数据包逐跳、DNAT/SNAT、conntrack、IPVS、eBPF、Service Mesh、Ambient Mesh |
| 15 | Block/File/Object IO、CSI Controller/Node、WaitForFirstConsumer、Ceph PG/CRUSH、PITR |
| 16 | Redis 为什么快、Cache Aside、穿透/击穿/雪崩、Hot/Big Key、NX/EX、锁续期、Fencing Token |
| 17 | Kafka Partition、Leader/Follower、ISR、acks、消费语义、Exactly-once、Rebalance、Lag、DLQ |
| 18 | Timeout Budget、Little's Law、Retry Storm、Jitter、Circuit Breaker、Bulkhead、TCC、Saga、Inbox/Outbox |
| 19 | Alertmanager、Exemplar、Tail Sampling、K8s Events、OOM/Throttle、Profiling、Thanos、成本治理 |
| 20 | SAST/依赖/镜像扫描、Provenance、GitOps Drift、Canary 门禁、Feature Flag、Schema Evolution |
| 21 | DaemonSet、Job/CronJob、QoS、LimitRange、Quota、PDB、Graceful Shutdown、Priority/Preemption、HPA/VPA/KEDA |
| 22 | HA、SPOF、容量规划、负载测试、Backpressure、Chaos Engineering、GameDay、Postmortem |
| 23 | Workload Identity、KMS、Secret Rotation、Seccomp、Capabilities、gVisor/Kata、SPIFFE、Egress、多租户 |
| 24 | 从 SLI → Change → Trace → RED/USE → Logs/Events 的生产排障 Runbook |

## 核心心智模型

```text
Developer
   ↓
  Git
   ↓
CI / Supply Chain
   ↓
Registry
   ↓
GitOps / Progressive Delivery
   ↓
Kubernetes
├─ Compute / Workloads / Scheduling
├─ Network / Gateway / eBPF / Mesh
├─ Storage / CSI / Stateful Workloads
├─ Microservices / Redis / Kafka / Transactions
├─ Observability / SLO / Profiling
└─ Security / Identity / Policy / Runtime
   ↓
Platform Engineering
   ↓
Multi-Cluster / Serverless / FinOps / Chaos
```

## 阅读方式

建议先读 00–11 建立完整全局地图，再按需要进入 12–24 深潜。

每个主题尽量按以下结构理解：

**它是什么 → 为什么出现 → 底层如何工作 → 数据/请求如何流动 → 有哪些失败模式 → 如何在生产落地 → 有什么代价与替代方案**

## 为什么 V2 要拆出深度章节

V1 主干正确，但为了可读性压缩了三级机制。V2 明确把这些机制保留下来，而不是只保留“名词 + 一句话定义”。

例如不再只写：

```text
Controller 使用 Informer
```

而是展开：

```text
List/Watch
→ Reflector
→ DeltaFIFO
→ Informer
→ Indexer
→ EventHandler
→ WorkQueue
→ Worker
→ Reconcile
```

同理，Service 不再只写“转发到 Pod”，而是继续追踪 DNAT、conntrack、跨 Node CNI 和 eBPF 数据面。

## 适合谁

- 前端 / iOS / Android 开发，希望补齐后端和基础设施全貌。
- 已经使用 Kubernetes，但知识点零散。
- 系统架构设计与架构师备考。
- 希望从“会配置”进入“理解机制、故障与取舍”。

## 项目结构

```text
.
├── index.html
├── assets/
│   ├── app.js
│   └── styles.css
├── docs/
│   ├── 00-overview.md
│   ├── ...
│   └── 24-production-troubleshooting.md
├── CHANGELOG.md
└── .github/workflows/pages.yml
```

## License

用于学习与知识整理。
