# 14 · Kubernetes 数据包逐跳分析：Service、NAT、conntrack、eBPF 与 Mesh

<div class="chapter-meta"><span>Packet Path</span><span>NAT</span><span>conntrack</span><span>Service</span><span>Mesh</span></div>

## 1. 从 Socket 开始

应用监听：

```text
0.0.0.0:8080
```

真正收包的链：

```text
NIC / veth
→ Linux Network Stack
→ Routing / Netfilter / eBPF
→ TCP
→ Socket
→ Process
```

Kubernetes 没有绕开 TCP/IP，只是在网络路径上自动配置大量逻辑。

## 2. Pod A 访问同 Node Pod B

```text
Pod A process
→ socket
→ eth0
→ veth pair
→ host bridge/routing
→ veth pair
→ Pod B eth0
→ socket
→ process
```

若使用 eBPF CNI，路径可能不完全依赖传统 Linux bridge，但“从 Pod Namespace 穿过 Host 数据面到另一个 Pod”这一逻辑不变。

## 3. 跨 Node + Overlay

```text
Pod A packet
src=10.244.1.10
dst=10.244.2.10

Node1封装：
outer src=192.168.1.10
outer dst=192.168.1.11

→ Underlay

Node2解封装
→ 原始Pod包
→ Pod B
```

VXLAN 常通过 UDP 封装二层帧。

## 4. MTU

底层 MTU=1500，但 VXLAN 增加 Header。

如果 Pod 仍发 1500 字节 payload 包，封装后可能超底层 MTU。

症状：

- Ping 小包正常。
- HTTP 小请求正常。
- 大响应/TLS 某些请求卡死。

因此 CNI 常把 Pod MTU 调低。

## 5. Service ClusterIP 为什么是虚拟 IP

```text
credit-service
10.96.10.20:80
```

它通常没有对应真实网卡。

数据平面只是在看到目标为该地址时，选择 Endpoint 并改写目的地址。

## 6. DNAT

原始：

```text
src=10.244.1.5:53000
dst=10.96.10.20:80
```

选择后端：

```text
dst=10.244.2.10:8080
```

这就是 Destination NAT 思路。

## 7. SNAT

Pod 出公网：

```text
src=10.244.1.5
dst=8.8.8.8
```

外部路由通常不知道怎么回 Pod 网段，因此可能改成：

```text
src=NodeIP
```

这就是 Source NAT / Masquerade。

## 8. conntrack

NAT 不是单向“改一下 IP”。

返回包必须知道应该还原到哪个原始连接。

conntrack 保存类似：

```text
Original Tuple
↔
Translated Tuple
```

当连接数巨大时，conntrack table full 会导致新连接异常。

排障时需要关注：

- conntrack max。
- 当前 entry。
- 大量短连接。
- TIME_WAIT。
- NAT Gateway/SNAT Port 耗尽。

## 9. iptables Service 规则思想

kube-proxy Watch Service/EndpointSlice，生成规则：

```text
Service VIP
→ chain
→ probability
→ endpoint chain
→ DNAT Pod IP
```

规模非常大时规则更新和匹配管理成本会上升。

## 10. IPVS

IPVS 原生抽象：

```text
Virtual Server
→ Real Server A
→ Real Server B
→ Real Server C
```

更像内核级 L4 LB，适合大量服务后端。

## 11. Cilium eBPF

eBPF 程序挂在内核数据路径，使用 BPF Map 保存：

```text
Service Key
→ Backend Set
```

收到包后：

```text
lookup
→ select backend
→ rewrite/redirect
```

避免依赖海量传统 iptables 链。

## 12. eBPF 为什么不仅是网络

同一机制还能用于：

- NetworkPolicy。
- TCP Metrics。
- DNS Visibility。
- Runtime Security。
- System Call Observability。
- Load Balancing。

所以 eBPF 是“内核可编程能力”，不是一个具体网络产品。

## 13. Pod 出公网完整路径

```text
Application
→ Pod eth0
→ veth
→ Node routing
→ SNAT/Masquerade
→ Node NIC
→ VPC Route
→ NAT Gateway / Internet Gateway
→ Internet
```

云上还可能叠加 Security Group、Network ACL、NAT Gateway 等云网络层。

## 14. NodePort

```text
NodeIP:30080
→ Service
→ Endpoint
```

请求进入任意 Node 后，不保证一定去本机 Pod。

如果跨 Node，会增加一跳。

## 15. LoadBalancer Service

云 Controller 读取：

```yaml
type: LoadBalancer
```

然后调用云 API 创建 LB。

这体现：

> Kubernetes API 对外部基础设施的声明式驱动。

## 16. ExternalName

ExternalName 本质偏 DNS：

```text
internal-name
→ CNAME
→ external.example.com
```

没有普通 Service Endpoint 数据面。

## 17. Headless Service

```yaml
clusterIP: None
```

不提供统一 VIP，DNS 返回具体 Endpoint，常用于 StatefulSet 成员发现。

## 18. Service Mesh Sidecar 流量劫持

传统 Istio Sidecar 模式：

```text
App
→ iptables redirect
→ Envoy outbound
→ network
→ Envoy inbound
→ App
```

业务应用以为自己直接访问远程服务，实际流量被透明代理接管。

## 19. Mesh 能做什么

数据面 Proxy 可统一处理：

- mTLS。
- L7 Route。
- Retry。
- Timeout。
- Circuit Breaking。
- Telemetry。
- Traffic Split。

但“是否可以重试一次创建借款”仍是业务语义，不能全交给 Mesh。

## 20. Sidecar 成本

5000 Pods × 1 Envoy：

```text
额外 5000 个 Proxy
```

会带来 CPU、Memory、连接数、升级和观测成本。

## 21. Ambient Mesh

目标是减少每 Pod Sidecar。

简化理解：

```text
Pod
→ node-level ztunnel
→ 网络
```

需要更复杂 L7 能力时再经过 Waypoint。

这把 L4 安全隧道和 L7 Policy/Route 分层。

## 22. NetworkPolicy 的数据面

Kubernetes API 只存规则。

真正执行者可能：

- Calico iptables/eBPF。
- Cilium eBPF。

例如 default deny 后，只允许：

```text
credit → risk:8080
```

这就是东西向微隔离。

## 23. DNS 故障如何识别

如果：

```text
curl service-name
失败
```

但：

```text
curl ServiceIP
成功
```

说明网络和 Service 数据面可能没问题，重点查 CoreDNS、resolv.conf、DNS Policy、缓存等。

## 24. 从公网到应用完整路径

```mermaid
flowchart LR
 A[Client] --> B[DNS]
 B --> C[Edge/WAF]
 C --> D[Cloud LB]
 D --> E[Node]
 E --> F[Gateway Pod]
 F --> G[Service VIP]
 G --> H[eBPF/IPVS/iptables]
 H --> I[CNI Route]
 I --> J[Target Node]
 J --> K[veth]
 K --> L[Pod eth0]
 L --> M[TCP Socket]
 M --> N[App]
```

真正理解这条链后，Kubernetes 网络排障就从“玄学”变成逐层验证。
