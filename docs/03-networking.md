# 03 · Kubernetes 网络：从 Pod IP 到 eBPF

<div class="chapter-meta"><span>Network Namespace</span><span>veth</span><span>CNI</span><span>Service</span><span>eBPF</span></div>

## 1. 先分清三类 IP

| 类型 | 示例 | 含义 |
|---|---|---|
| Node IP | 192.168.1.10 | 真实服务器/云主机地址 |
| Pod IP | 10.244.1.10 | Pod 网络命名空间地址 |
| Service IP | 10.96.10.20 | 逻辑服务虚拟地址 |

Service ClusterIP 通常并不是某块真实网卡上的 IP。

## 2. Network Namespace 与 veth

Pod 拥有独立网络视图：

```text
Pod Namespace
eth0 / IP / route / socket
      │
      │ veth pair
      │
Host Namespace
```

veth 可以理解为“一根虚拟网线的两头”。

## 3. CNI 做什么

Pod 创建时，CNI 插件负责：

```text
创建网络命名空间连接
→ 创建 veth
→ 分配 Pod IP
→ 配置路由
→ 应用 NetworkPolicy
```

常见实现：Cilium、Calico、Flannel、Antrea。

## 4. 同 Node 与跨 Node

同 Node：

```text
Pod A → veth → bridge/host network → veth → Pod B
```

跨 Node 才是难点：

```text
Pod A
→ Node1
→ CNI routing / tunnel
→ Node2
→ Pod B
```

## 5. Overlay：VXLAN

底层物理网络只认识 Node IP，不认识 Pod 网段时，可以封装：

```text
外层：Node1 → Node2
内层：Pod A → Pod B
```

VXLAN 是常见方案。

优点：底层网络无需感知 Pod 路由。  
缺点：封装开销、MTU、排障复杂度。

典型问题是 MTU 不匹配造成“大包失败、小包正常”。

## 6. Native Routing / BGP

另一条路线是让真实网络直接知道：

```text
10.244.1.0/24 → Node1
10.244.2.0/24 → Node2
```

Calico 常通过 BGP 传播 Pod 网段。

优点：路径直接、性能高。  
代价：更依赖底层网络能力。

## 7. Service 的本质

假设：

```text
credit-service
10.96.10.20:80

Endpoints:
10.244.1.10:8080
10.244.2.10:8080
10.244.3.10:8080
```

客户端访问 Service IP，数据平面将目标改写/负载均衡到某个 Endpoint。

因此可把 Service 理解为：

> 稳定逻辑地址 + Endpoint 集合 + 内核转发规则。

## 8. Selector 与 EndpointSlice

```yaml
Service selector:
  app: credit-service
```

匹配：

```yaml
Pod labels:
  app: credit-service
```

EndpointSlice Controller 会维护当前 Ready Pod 的地址。Pod 扩容、缩容、重建后，调用方不需要知道新 IP。

## 9. kube-proxy、iptables 与 IPVS

kube-proxy 很多时候并不是“真正代理所有数据包”的用户态进程，而是规则控制器：

```text
kube-proxy
→ 配置内核
→ iptables / IPVS
→ 内核转发数据包
```

iptables 方案简单但大规模规则维护成本较高；IPVS 是 Linux 内核四层负载均衡能力。

## 10. eBPF 与 Cilium

eBPF 允许在 Linux 内核关键路径运行受验证的可编程逻辑。

Cilium 利用它实现：

- Pod 网络。
- Service Load Balancing。
- NetworkPolicy。
- 可观测性。
- 部分 Service Mesh 能力。
- kube-proxy replacement。

传统：

```text
Service IP → 大量 iptables rules → Pod
```

eBPF 模式：

```text
Service IP → BPF Map Lookup → Backend Pod
```

## 11. CoreDNS：内部服务发现

```text
credit-service.finance.svc.cluster.local
```

结构：

```text
service.namespace.svc.cluster-domain
```

调用：

```text
loan-service
→ DNS query
→ CoreDNS
→ Service ClusterIP
→ Endpoint Pod
```

公网 DNS 和 CoreDNS 解决的是不同层次的问题。

## 12. Service 类型

- ClusterIP：集群内部服务。
- NodePort：在每个 Node 暴露端口。
- LoadBalancer：让云厂商创建外部 LB。
- ExternalName：DNS CNAME 映射外部服务。

## 13. SNAT / DNAT / conntrack

DNAT：修改目标地址，例如 Service IP → Pod IP。  
SNAT：修改源地址，例如 Pod 出公网时 → Node IP。

conntrack 记录 NAT 前后的连接映射。连接追踪表耗尽会造成新连接异常，是生产网络常见故障点之一。

## 14. Ingress / Gateway / API Gateway

不要混淆：

```text
Service
→ 集群内部稳定服务入口

Ingress / Gateway API
→ Kubernetes HTTP/TCP/UDP 入站路由

API Gateway
→ 认证、限流、业务 API 治理、协议转换
```

现代 Gateway API 比传统 Ingress 具有更强角色模型和路由表达能力。

## 15. NetworkPolicy

默认网络可达并不代表应该全部互通。

例如：

```text
credit-service → risk-service   Allow
user-service   → database       Deny
```

Kubernetes 定义 Policy，真正执行通常由 CNI 完成。

## 16. Service Mesh 与 mTLS

传统 Sidecar：

```text
App A → Envoy → Network → Envoy → App B
```

代理负责 mTLS、Retry、Timeout、流量治理、Tracing。

mTLS 的核心是双方互相认证，而不仅是“加密”。它支撑 Zero Trust 中的服务身份。

现代体系也出现 Ambient Mesh 等减少每 Pod Sidecar 成本的方式。

## 17. 一个公网请求真正怎么进 Pod

```mermaid
flowchart LR
 A[iPhone] --> B[Public DNS]
 B --> C[CDN/WAF]
 C --> D[Cloud LB]
 D --> E[Gateway]
 E --> F[Service ClusterIP]
 F --> G[iptables/IPVS/eBPF]
 G --> H[CNI Routing]
 H --> I[Target Node]
 I --> J[veth]
 J --> K[Pod Socket]
 K --> L[Application]
```

## 18. 网络排障顺序

不要直接猜“网络坏了”。

```text
进程是否监听？
→ Pod Ready？
→ Pod IP 直连？
→ EndpointSlice 有后端？
→ Service IP？
→ DNS？
→ Gateway？
→ Load Balancer？
→ 公网 DNS？
```

按层排查，能极大缩小问题范围。
