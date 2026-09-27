# Cloud Native Learn ☁️

一套面向开发者的 **云原生架构“从零到全貌”学习站点**。目标不是背 Kubernetes / Kafka / Istio 名词，而是沿着一次真实业务请求，把底层机制、分布式系统、生产治理和平台工程串成完整心智模型。

## 在线站点

GitHub Pages 发布地址：

**https://whojave.github.io/Cloud-Native-Learn/**

> 如果仓库第一次启用 GitHub Pages，需在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。仓库已经包含官方 Pages 自动发布工作流，之后每次 push 到 `main` 都会自动发布。

## 内容地图

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
| 09 | 多集群、Serverless、弹性与 FinOps |
| 10 | 综合案例：消费金融额度申请端到端云原生链路 |
| 11 | 学习路线与架构师检查清单 |

## 核心心智模型

```text
Developer
   ↓
  Git
   ↓
  CI ── Test / Scan / SBOM / Sign
   ↓
Registry
   ↓
GitOps
   ↓
Kubernetes
├─ Compute: Pod / Scheduler / CRI
├─ Network: CNI / Service / eBPF / Gateway
├─ Storage: CSI / PV / StatefulSet
├─ Microservices: REST / gRPC / Kafka
├─ Observability: Metrics / Logs / Traces
└─ Security: Identity / Policy / Runtime
   ↓
Platform Engineering
   ↓
Multi-Cluster / Serverless / FinOps
```

## 适合谁

- 有前端、iOS、Android、后端开发经验，希望补齐服务端与基础设施全貌。
- 正在学习 Kubernetes，但感觉知识点零散。
- 系统架构师/架构设计学习者，希望把技术名词串成真实系统。
- 希望从“会部署”继续进入“为什么这么设计”。

## 阅读方式

直接打开 Pages 站点，通过左侧章节顺序阅读。章节采用：

**问题 → 原理 → 数据/请求如何流动 → 失败模式 → 生产实践**

的方式组织。

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
│   └── 11-roadmap.md
└── .github/workflows/pages.yml
```

## License

用于学习与知识整理。