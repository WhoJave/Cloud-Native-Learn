# 15 · 存储深潜：IO 语义、CSI 调度、Ceph CRUSH、备份与数据库恢复

<div class="chapter-meta"><span>Block/File/Object</span><span>CSI</span><span>Topology</span><span>Ceph</span><span>Backup</span></div>

## 1. Block / File / Object 不是产品分类，而是访问模型

### Block
应用看到“块设备”：

```text
/dev/sdb
```

需要自己格式化文件系统。

适合数据库，因为低延迟、随机 IO 能力通常更可控。

### File
应用看到共享目录：

```text
/shared/path
```

由 NFS/CephFS 等提供文件语义。

### Object
通过 API 操作：

```text
PUT / GET Object
Bucket + Key
```

没有传统 POSIX 目录/块设备语义。

## 2. 为什么数据库更喜欢 Block

数据库自己管理：

- Page。
- WAL/Redo。
- fsync。
- Buffer Pool。
- Random Read/Write。

如果底层是本地/网络块设备，数据库更容易控制写入和持久化行为。

对象存储则更适合备份、归档、数据湖，而不是直接把 MySQL 数据文件放进去。

## 3. RWO 不等于“只能一个 Pod”

ReadWriteOnce 的经典含义是“某个 Volume 可被一个 Node 以读写方式挂载”。

如果多个 Pod 恰好在同一个 Node，具体 Driver/Volume 语义可能允许共享。

因此判断能否多 Pod 使用时要看：

- Access Mode。
- CSI Driver。
- 文件系统。
- Node Attachment。
- 应用是否支持共享写。

## 4. RWX 也不等于数据库可共享数据目录

即使 NFS/CephFS 支持多个节点读写：

```text
Pod A
Pod B
→ 同一个目录
```

也不代表两个 MySQL 实例可以安全同时写同一个 datadir。

存储允许 ≠ 应用协议允许。

## 5. CSI Controller 与 Node Plugin

典型 CSI 由两类组件：

```text
Controller Side
→ Create/Delete/Attach Volume

Node Side
→ Stage/Publish/Mount Volume
```

Kubelet 与 Node Plugin 协作把存储最终挂进 Pod。

## 6. 一次云盘动态创建

```text
PVC
→ StorageClass
→ CSI Controller CreateVolume
→ Cloud Volume
→ PV
→ Scheduler选Node
→ ControllerPublish Attach
→ NodeStage
→ NodePublish
→ Pod mountPath
```

每一步都可能失败，对应不同 Event。

## 7. WaitForFirstConsumer

Immediate 模式可能先创建出 Zone A 的 Volume，后来 Pod 最优 Node 却在 Zone B。

WaitForFirstConsumer：

```text
先等 Pod
→ Scheduler 综合候选 Node
→ 再在合适 Zone 创建 Volume
```

把 Compute Scheduling 和 Storage Topology 协调起来。

## 8. Pod 跨 Node 恢复

数据库 Pod 从 Node1 故障迁到 Node2，不只是“重建 Pod”：

```text
确认旧Node状态
→ Volume Detach Node1
→ Attach Node2
→ Filesystem Mount
→ Container Start
→ DB Crash Recovery / WAL Replay
→ Readiness
```

这就是 Stateful Workload 故障恢复通常比 Stateless 慢得多的原因。

## 9. Multi-Attach 错误

RWO 云盘如果仍然认为挂在旧 Node，新 Pod 在新 Node Attach 时可能出现：

```text
Multi-Attach error
```

此时不能简单认为是 Pod 问题，要看云盘 Attachment 状态和旧 Node 是否真正释放。

## 10. StatefulSet PVC 模板

```text
mysql-0 → pvc-data-mysql-0
mysql-1 → pvc-data-mysql-1
mysql-2 → pvc-data-mysql-2
```

Pod 重建仍绑定自己的 PVC。

这解决“身份 ↔ 数据”的稳定关联。

## 11. Headless Service 与成员身份

数据库/Kafka 节点常需要：

```text
mysql-0.mysql
mysql-1.mysql
```

这比随机 Pod 名称更适合复制拓扑和成员发现。

## 12. Snapshot：Crash-consistent

存储快照如果在应用不知道的情况下瞬间截取底层块状态，通常只能保证类似“机器突然断电后磁盘是什么样”。

数据库启动时可能需要 Crash Recovery。

## 13. Application-consistent Snapshot

更强的一致快照需要：

- Flush Buffer。
- Freeze FS。
- 数据库 Checkpoint。
- Pause Write。
- 与备份工具协作。

不同数据库有自己的正确做法。

## 14. HA 与 Backup

### HA
Primary 挂了，Replica 顶上。

### Backup
用户误删表、逻辑损坏、勒索、跨地域灾难后还能恢复。

如果执行：

```sql
DROP TABLE important;
```

复制系统可能把删除操作同步给所有 Replica。

所以：

```text
Replication ≠ Backup
```

## 15. PITR

Point-in-Time Recovery 允许恢复到某个时间点。

例如：

```text
13:00 Full/Base Backup
+
13:00~15:00 WAL/Binlog
```

误操作发生 14:37，可恢复到 14:36:59。

这是关键数据库常见能力。

## 16. RPO / RTO 与存储

RPO 决定：

> 最多允许丢多少数据。

RTO 决定：

> 多久恢复服务。

备份策略必须从业务目标倒推，而不是“每天备份一次就算做了灾备”。

## 17. Ceph 基础

Ceph 将大量磁盘组合成分布式存储。

核心：

- OSD：数据面。
- MON：Cluster Map / Quorum。
- MGR：管理和指标。

## 18. Placement Group

Ceph 不直接让每个对象对每个 OSD 建巨大映射表。

对象先映射到 Placement Group，再由 CRUSH 决定 PG 对应哪些 OSD。

这是扩展性的重要设计。

## 19. CRUSH

CRUSH 根据：

- Object/PG。
- OSD 权重。
- Failure Domain。
- Rack/Host/Zone 拓扑。

计算副本放置位置。

例如规则可要求副本必须分散到不同 Host/Rack，避免一个机器/机架带走全部副本。

## 20. Ceph 自愈

某 OSD 故障：

```text
副本数不足
→ 集群重新计算放置
→ 从健康副本复制
→ 恢复目标副本数
```

这和 Kubernetes Reconcile 思想有相似之处，但作用层次不同。

## 21. Rook

Rook 把 Ceph 的部署和运维封装成 Kubernetes Operator：

```text
CephCluster CR
→ Rook Operator
→ MON / OSD / MGR
```

注意它不是把存储复杂性变没，而是自动化了复杂操作。

## 22. 数据库到底该不该跑 K8s

要评估：

- 团队是否有 DBA/SRE。
- Storage Driver 是否成熟。
- Failover 是否由 Operator 正确处理。
- Backup/PITR 是否经过演练。
- RPO/RTO 是否满足。
- Node/Zone 故障时是否验证过。

“Pod 能起来”远远不等于“数据库生产可用”。
