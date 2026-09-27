# 21 · Workload 全家桶、调度与资源治理：Deployment 之外还有什么

<div class="chapter-meta"><span>DaemonSet</span><span>Job/CronJob</span><span>PDB</span><span>Quota</span><span>Priority</span></div>

## 1. 裸 Pod

直接创建 Pod 后，上层没有 Controller 维持它的期望副本。

生产通常使用 Workload Controller。

## 2. Deployment

适合无状态 Web/API、可替换副本、Rolling Update。

~~~text
Deployment
→ ReplicaSet
→ Pods
~~~

## 3. StatefulSet

稳定名字、网络身份、Volume，适合有状态工作负载。

## 4. DaemonSet

目标是每个符合条件的 Node 跑一个 Pod。

常见：

- Log Agent。
- Node Exporter。
- CNI Agent。
- Security Agent。
- CSI Node Plugin。

## 5. Job

运行到完成，不是长期 Running。

适合一次性迁移、批处理、修复任务。

关注：

- Completion。
- Parallelism。
- Retry。
- Backoff。

## 6. CronJob

按计划创建 Job。

适合定时结算、清理、报表、备份触发。

必须考虑任务幂等和并发策略。

## 7. Requests

Scheduler 主要根据 Request 判断 Pod 是否能放下。

Request 过大会浪费集群账面资源。

## 8. Limits

Memory 超限可能 OOMKilled；CPU 超限通常被 Throttle。

Request 和 Limit 不是一回事。

## 9. QoS Class

- Guaranteed。
- Burstable。
- BestEffort。

Node 资源紧张时影响驱逐优先级。

## 10. LimitRange

为 Namespace 提供默认/最大/最小 Request/Limit，避免开发者完全不设置资源。

## 11. ResourceQuota

限制 Namespace 总量：

~~~text
CPU
Memory
PVC
Pod Count
Service
~~~

用于多团队共享集群。

## 12. PodDisruptionBudget

PDB 保护计划内驱逐，例如 Drain/Upgrade。

~~~text
minAvailable=2
~~~

不等于能阻止机器突然断电。

## 13. Graceful Shutdown

~~~text
SIGTERM
→ 停止接新请求
→ 完成在途请求
→ 关闭连接
→ exit
~~~

配合 terminationGracePeriodSeconds、PreStop、Readiness。

## 14. Readiness 与优雅下线

如果应用收到 SIGTERM 就立刻退出，Service/LB 摘除传播未完成时会产生 5xx。

需要预留下线窗口。

## 15. PriorityClass

给关键 Pod 更高调度优先级。

必须谨慎，避免普通工作负载长期饥饿。

## 16. Preemption

高优先级 Pod 无法调度时，可驱逐低优先级 Pod 腾资源。

它不是容量规划的替代。

## 17. NodeSelector / Affinity

NodeSelector 是硬标签匹配。

NodeAffinity 支持 required / preferred，更灵活。

## 18. PodAffinity / AntiAffinity

AntiAffinity 常用于把同服务副本分散到不同 Node，提高容错。

## 19. TopologySpreadConstraints

直接表达在 zone/hostname 上的均匀分布，比复杂 AntiAffinity 更适合很多场景。

## 20. Taint / Toleration

Taint=节点排斥；Toleration=Pod接受。

适合 GPU、数据库、Spot、专属节点池。

## 21. Cordon / Drain

~~~text
cordon
→ 不再接新Pod

drain
→ 驱逐可迁移Pod
~~~

PDB、DaemonSet、本地数据都会影响 Drain。

## 22. Eviction

Node Memory/Disk 压力时 kubelet 可能主动驱逐 Pod。

要区分 Evicted、OOMKilled、Application Crash。

## 23. HPA

可根据 CPU、Memory、Custom/External Metrics 调整副本。

CPU 百分比常依赖 Request，因此 Request 设置错误会影响 HPA 语义。

## 24. VPA

根据历史使用调整 Request。

自动模式可能需要重建 Pod；和 HPA 同用时避免两者同时控制同一资源维度。

## 25. Cluster Autoscaler

Pod 因资源不足 Pending 时，CA 判断扩 Node Group 是否能解决。

Scale Down 还需考虑 PDB、本地存储等约束。

## 26. KEDA

~~~text
Kafka Lag / Queue Depth / Prometheus Metric
→ KEDA
→ HPA
→ Pods
~~~

对异步 Consumer 比仅 CPU 更符合真实负载。

## 27. Requests 的成本含义

~~~text
Request=2CPU
真实P99=0.3CPU
~~~

Scheduler 仍把 2CPU 当成已占用。

Request 直接影响集群密度、成本、Autoscaler 和调度成功率。
