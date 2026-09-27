# 04 · 云原生存储：Pod 会死，数据为什么不死

<div class="chapter-meta"><span>Volume</span><span>PV/PVC</span><span>StorageClass</span><span>CSI</span><span>StatefulSet</span></div>

## 1. 容器文件系统为什么不可靠

镜像只读层 + 容器可写层构成运行时文件系统。容器删除后，可写层通常也消失。

因此：

> Container 生命周期与 Data 生命周期必须分离。

## 2. emptyDir 与 hostPath

**emptyDir**：Pod 生命周期内的临时共享目录，多个容器可共享；Pod 删除后消失。

**hostPath**：直接挂宿主机目录。适合系统 Agent 等场景，但业务数据会和 Node 强绑定，不适合作为普通持久化方案。

## 3. Volume 的核心价值

```text
Container
   ↓
Volume
   ↓
Persistent Storage
```

Pod 可以重建，数据仍然存在。

## 4. PV 与 PVC

- PV（PersistentVolume）：集群中真实可用的存储资源。
- PVC（PersistentVolumeClaim）：应用提出的存储需求。

```text
PVC = “我要 100Gi SSD”
PV  = “这里有一块符合条件的存储”
```

这让应用和基础设施解耦。

## 5. StorageClass 与动态供给

手工为每个 PVC 创建 PV 无法扩展。

StorageClass 定义“存储套餐”：

```text
fast-ssd
standard
archive
```

流程：

```text
PVC
→ StorageClass
→ CSI Driver
→ 创建真实云盘/存储
→ PV
→ PVC Bound
```

这就是 Dynamic Provisioning。

## 6. CSI 是什么

CSI：Container Storage Interface。

它与 CRI/CNI 一样，把 Kubernetes 与厂商实现解耦。

典型动作：

```text
CreateVolume
Attach
NodeStage
NodePublish
Mount
DeleteVolume
```

常见驱动：AWS EBS CSI、Azure Disk CSI、Ceph CSI。

## 7. 存储会影响调度

某云盘只属于 Zone A，Pod 如果被调度到 Zone B 可能无法挂载。

因此 Scheduler 必须考虑 Volume Topology。

`WaitForFirstConsumer` 的意义就是：先结合 Pod 最终调度位置，再决定在哪个 Zone 创建存储。

## 8. Access Mode

- RWO：ReadWriteOnce，常见块存储模式。
- RWX：ReadWriteMany，多节点可共享读写。
- ROX：ReadOnlyMany。
- RWOP：ReadWriteOncePod。

不要简单把 RWO 理解为“只能一个 Pod”，实际还和节点挂载语义有关。

## 9. Block / File / Object

| 类型 | 典型产品 | 适合场景 |
|---|---|---|
| Block | EBS、Ceph RBD、SAN | MySQL、PostgreSQL |
| File | NFS、EFS、CephFS | 多 Pod 共享目录 |
| Object | S3、OSS、MinIO | 图片、备份、日志、数据湖 |

数据库磁盘和对象存储是完全不同的抽象。

## 10. StatefulSet 为什么出现

Deployment 假设 Pod 可互换：

```text
credit-abc
credit-def
credit-xyz
```

StatefulSet 给 Pod 稳定身份：

```text
mysql-0
mysql-1
mysql-2
```

并提供：

- 稳定名称。
- 稳定网络身份。
- 每实例独立 PVC。
- 有序启动/停止。
- 有序滚动升级。

## 11. StatefulSet + Headless Service

```yaml
clusterIP: None
```

Headless Service 不提供普通 ClusterIP，而让 DNS 暴露具体 Pod 地址，例如：

```text
mysql-0.mysql
mysql-1.mysql
mysql-2.mysql
```

适合需要稳定成员身份的数据库/Kafka 集群。

## 12. StatefulSet 不是数据库高可用

Kubernetes 知道 Pod 是否存活，却不知道：

- 哪个 PostgreSQL 应成为 Primary。
- 哪个 Replica 数据最新。
- 如何防止双主。
- 如何执行 PITR。

因此：

```text
StatefulSet
→ 负责身份、Pod、Volume 基础

Operator
→ 负责数据库领域逻辑
```

## 13. Ceph 与 Rook

Ceph 是分布式存储系统，可提供：

- RBD：Block。
- CephFS：File。
- RGW：Object。

核心组件可先理解：

- OSD：真正管理数据和磁盘。
- MON：维护集群成员和 Quorum。
- MGR：管理、指标和 Dashboard。

Rook 则是 Kubernetes 中自动部署和运维 Ceph 的 Operator。

```text
Kubernetes
→ Rook Operator
→ Ceph
```

## 14. Longhorn / NFS / 云托管存储

Longhorn：更 Kubernetes-native 的分布式块存储，使用相对简单。  
NFS：简单、成熟、适合 RWX，共享文件场景仍很常见。  
云上通常更推荐托管组合，例如 EBS/EFS/S3，减少自建存储运维。

## 15. PV 回收与误删风险

PVC 删除后真实存储是否删除由 Reclaim Policy 决定：

- Delete：连底层 Volume 一起删除。
- Retain：保留数据，由管理员处理。

生产数据库必须对 PVC 删除、RBAC、快照和备份做保护。

## 16. Snapshot ≠ Backup ≠ HA

三者不能混淆：

- HA：节点挂了服务继续。
- Snapshot：存储层某一时刻快照。
- Backup：可用于误删、逻辑损坏、灾难恢复的数据副本。

主从复制无法防止 `DROP TABLE` 被同步到所有副本。

## 17. 数据库到底要不要跑 Kubernetes

问题不是“能不能”，而是“值不值得自己承担状态管理复杂度”。

适合托管数据库：

- 团队较小。
- 数据极关键。
- 已深度使用某云平台。
- 不希望自己处理主从、备份、升级。

适合 Operator / Kubernetes：

- 私有云、多云、统一平台要求强。
- 有数据库 SRE 能力。
- 需要高度自动化和可移植性。

## 18. 云原生应用的状态原则

尽量让业务 Pod 无状态：

```text
Credit Service → PostgreSQL
重复提交锁 → Redis
领域事件 → Kafka
文件 → Object Storage
日志 → Loki/Object Storage
```

Pod 可以随时被杀掉和重建，这样 Kubernetes 的弹性、自愈和滚动发布才真正发挥价值。
