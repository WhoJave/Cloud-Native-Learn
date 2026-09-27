# 13 · Kubernetes 内核机制深潜：Informer、WorkQueue、Pod Sandbox 与控制面 HA

<div class="chapter-meta"><span>List/Watch</span><span>Informer</span><span>WorkQueue</span><span>Pod Sandbox</span><span>HA</span></div>

## 1. Controller 不是不断轮询全部对象

一个简单但低效的设计会是：

```text
每秒：
GET all Deployments
GET all Pods
GET all Nodes
```

规模上去后 API Server 会被打爆。

Kubernetes 更核心的模式是：

```text
List
+ Watch
+ Local Cache
+ WorkQueue
+ Reconcile
```

## 2. Reflector

Reflector 与 API Server 建立 List/Watch。

第一次：

```text
LIST resources
```

拿到初始全集。

之后：

```text
WATCH resources
```

持续接收 ADDED / MODIFIED / DELETED 事件。

如果 Watch 因网络、超时或 ResourceVersion 失效中断，会重新建立。

## 3. DeltaFIFO

变化不会直接把业务逻辑塞到 Watch 回调里。

典型 client-go 模型会把对象变化作为 Delta 放进队列：

```text
Added
Updated
Deleted
Sync
```

DeltaFIFO 让事件接收和处理解耦。

## 4. Informer

Informer 把：

```text
Reflector
+ DeltaFIFO
+ Local Store / Indexer
+ Event Handler
```

组合起来。

Controller 很多读取直接访问本地 Cache，而不是每次打 API Server。

## 5. Indexer

Indexer 是本地对象缓存，并支持按 Namespace、字段或自定义索引快速查找。

例如 Controller 要找某 Deployment 对应的 ReplicaSet，不需要每次远程请求全部对象。

## 6. Event Handler

Informer 接收事件后触发：

```text
OnAdd
OnUpdate
OnDelete
```

但成熟 Controller 通常不直接在回调里执行重业务，而只是把对象 Key 放入 WorkQueue：

```text
namespace/name
```

## 7. WorkQueue

```text
Informer Event
→ key
→ WorkQueue
→ Worker
→ Reconcile
```

优点：

- 异步处理。
- 可多个 Worker 并发。
- 失败可以 Requeue。
- 可以 Rate Limit。
- 同一个 Key 可合并重复事件。

这比“每个事件都立即执行完整业务”稳健很多。

## 8. Requeue 与退避

Reconcile 失败不应无限高速重试。

典型：

```text
失败
→ AddRateLimited
→ 延迟
→ Retry
```

成功后 Forget。

这和微服务 Retry 的思想一样：必须有边界和退避。

## 9. 为什么 Controller 只关心期望状态

事件只是“提示可能发生变化”。

真正正确逻辑应该：

```text
收到事件
→ 重新读取当前事实
→ 比较 Desired / Actual
→ Reconcile
```

不能假定每个事件都永不丢失、永不重复。

这也是 Controller 天然幂等的重要原因。

## 10. Deployment Controller 与 ReplicaSet Controller

```text
Deployment Controller
→ 负责 ReplicaSet 的版本与比例

ReplicaSet Controller
→ 负责 Pod 数量
```

两者各自只维护自己的局部不变量。

复杂系统通过大量简单 Controller 协作，而不是一个超级 Controller 负责所有东西。

## 11. Scheduler 的更细过程

调度队列中存在未绑定 Node 的 Pod。

### Filter
去掉不可能运行的节点：

- 资源不足。
- Taint 不满足。
- NodeAffinity 不满足。
- Volume Zone 不匹配。
- Port 冲突。
- Pod Topology 约束不满足。

### Score
对候选节点评分：

- 资源均衡。
- Affinity 偏好。
- 镜像本地性。
- 拓扑分散。

### Bind
最终把 Pod 与 Node 的绑定写入 API。

Scheduler 不启动容器。

## 12. Preemption

如果高优先级 Pod 无处可放，可以考虑驱逐低优先级 Pod，为高优先级工作负载腾资源。

这要求配合 PriorityClass 谨慎设计，否则可能造成普通业务长期饥饿。

## 13. kubelet Pod Sync Loop

kubelet 持续把“Node 上应该有什么 Pod”与“实际有什么”对齐。

它需要处理：

- Pod Sandbox。
- Image Pull。
- Container Lifecycle。
- Probe。
- Volume。
- CNI。
- Pod Status。
- Restart Policy。

所以 kubelet 自己也是一个长期 Reconcile Agent。

## 14. Pod Sandbox

Pod 不是直接启动一个 App Container。

通常先准备：

```text
Pod Sandbox
→ Network Namespace
→ Pod IP
→ 基础网络环境
```

再把多个 Container 放进去。

同 Pod Container 因此共享：

- Network Namespace。
- IP。
- localhost。
- Port 空间。

这就是 Sidecar 可以通过 localhost 与主容器通信的原因。

## 15. Pause Container

传统 Kubernetes/container runtime 实现中常看到极小的 pause 容器，用来持有 Pod 级 Namespace 生命周期。

应用容器重启时，Pod 的网络 Namespace 不必跟着消失。

重点不在名字，而在于：

> Pod 需要一个独立于业务容器的共享 Sandbox 生命周期。

## 16. Init Container

Init Container 在主应用前按顺序执行。

适合：

- 等依赖。
- 生成配置。
- 数据迁移准备。
- 权限初始化。

不要把长期 Sidecar 职责塞进 Init Container。

## 17. Sidecar

Sidecar 与主容器同 Pod，常见：

- Proxy。
- Log Agent。
- Config Reloader。
- Secret Agent。

代价是共享 Pod 生命周期和资源，Sidecar 过多会增加每 Pod 成本。

## 18. API Server 挂了会怎样

已经运行的 Pod 不会因为 API Server 短暂不可用就自动停止。

通常仍可以：

- 继续处理已有业务流量。
- Service 数据面继续转发。
- 容器继续运行。

但会影响：

- 新部署。
- 新调度。
- 扩缩容。
- Controller 调谐。
- 状态更新。

这体现了 Control Plane 与 Data Plane 的解耦。

## 19. etcd 完全不可用会怎样

API Server 无法持久化新的集群状态。

已有业务进程仍可能继续，但控制面无法正常变化。

因此 etcd 是控制面的最关键状态存储之一。

## 20. Control Plane HA

典型：

```text
API LB
├→ API Server 1
├→ API Server 2
└→ API Server 3

etcd:
etcd1 / etcd2 / etcd3
```

API Server 可以多实例无状态扩展；etcd 依赖 Raft 多数派。

Scheduler / Controller Manager 通常多个实例部署，但通过 Leader Election 只有 Leader 执行主要控制逻辑。

## 21. Leader Election

多个 Controller Manager 同时工作会造成重复控制。

因此通常通过 Lease 等机制选 Leader：

```text
Instance A → Leader
Instance B → Standby
Instance C → Standby
```

Leader 挂掉后重新选举。

## 22. Finalizer

删除 Kubernetes 对象并不总是立刻物理消失。

某些 Controller 会写 Finalizer：

```text
DeletionTimestamp set
→ Controller执行外部资源清理
→ 移除Finalizer
→ 对象真正删除
```

例如云 LB、外部 Volume 等必须先清理真实资源。

## 23. OwnerReference 与 Garbage Collection

Deployment → ReplicaSet → Pod 存在所有者关系。

上层对象删除后，Garbage Collector 可以根据 OwnerReference 清理子资源。

这也是 Kubernetes 资源生命周期自动化的重要机制。

## 24. Kubernetes 的可扩展性来自什么

不是因为某个组件无限强，而是：

- API 统一。
- Watch 事件驱动。
- Informer 本地缓存。
- WorkQueue 异步。
- Controller 分工。
- 幂等 Reconcile。
- 最终一致。
- 数据平面与控制平面分离。

这些设计共同支撑大规模集群。
