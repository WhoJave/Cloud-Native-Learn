# 23 · 云原生安全深潜：身份、KMS、Seccomp、Sandbox、SPIFFE 与多租户

<div class="chapter-meta"><span>Identity</span><span>KMS</span><span>Seccomp</span><span>Sandbox</span><span>SPIFFE</span></div>

## 1. 安全首先是身份问题

云原生环境中最重要的主体包括：

- Human User。
- CI/CD。
- Pod/Workload。
- Node。
- Controller。
- Cloud Service。

不要让它们共享同一长期 Credential。

## 2. Human Identity

管理员登录最好通过企业 IdP/OIDC/SSO：

~~~text
User
→ IdP
→ short-lived token
→ Kubernetes API
~~~

而不是给每个人一个永不过期 client certificate。

## 3. Workload Identity

Pod 访问云服务时，不应把静态 Access Key 写进 Secret。

更好的模式：

~~~text
ServiceAccount
→ OIDC Federation
→ Cloud IAM Role
→ Short-lived Credential
~~~

把 Kubernetes Identity 映射到云 Identity。

## 4. Secret at Rest

Kubernetes Secret 默认的 Base64 只是编码。

敏感生产集群应考虑 API Server Encryption Configuration，使 Secret 在 etcd 中被加密。

## 5. Envelope Encryption / KMS

更成熟：

~~~text
Secret Data
→ Data Encryption Key
→ KEK由外部KMS保护
~~~

Kubernetes/平台不需要长期持有主密钥。

KMS 可以提供密钥轮换和审计。

## 6. Secret Rotation

Secret 设计必须回答：

- 多久轮换。
- 应用是否支持热更新。
- 旧 Credential 何时失效。
- 轮换失败如何回滚。

“存进 Vault”不代表 Rotation 自动完成。

## 7. External Secrets

常见模式：

~~~text
External Secret Manager
→ Controller/CSI
→ Pod
~~~

把 Secret 真值留在专门的密钥系统，而 Kubernetes 只承载引用或短期副本。

## 8. seccomp

seccomp 可以限制允许的 Linux System Call。

一个普通 Web 容器通常不需要访问所有 syscall。

如果攻击者拿到应用 RCE，seccomp 可继续限制其内核能力。

## 9. AppArmor / SELinux

它们提供强制访问控制，限制进程能访问哪些文件、能力和资源。

和容器 Namespace/Cgroup 属于不同安全层。

## 10. Linux Capabilities

root 权限被拆成细粒度能力。

生产容器通常：

~~~text
drop ALL
→ 只加确实需要的 capability
~~~

不要因为一个网络操作就给完整 privileged。

## 11. privileged 为什么危险

privileged 容器获得非常强的宿主机能力。

结合：

- hostPath。
- hostPID。
- hostNetwork。

可能大幅接近 Node 权限。

因此应在 Admission 阶段默认禁止。

## 12. readOnlyRootFilesystem

如果应用不需要写 root filesystem：

~~~text
readOnlyRootFilesystem: true
~~~

减少攻击者落盘与篡改应用文件的空间。

需要写的临时目录显式挂 emptyDir。

## 13. RuntimeClass

Kubernetes 可以为 Pod 选择不同 Runtime Handler。

例如普通 runc 与更强隔离 Sandbox Runtime。

## 14. gVisor / Kata Containers

gVisor 通过用户态内核/系统调用拦截减少直接接触 Host Kernel。

Kata 使用轻量 VM 提供更强硬件虚拟化隔离。

安全更强，但：

- 启动更慢。
- 资源成本更高。
- 兼容性更复杂。

适合不可信多租户等场景。

## 15. SPIFFE / SPIRE

SPIFFE 定义工作负载身份标准，例如：

~~~text
spiffe://example.org/ns/prod/sa/credit
~~~

SPIRE 等实现可以自动为 Workload 颁发短期身份凭证。

它和 mTLS/Zero Trust 很契合。

## 16. Service Mesh Identity

Mesh 可基于 Workload Identity 自动签发证书：

~~~text
Credit
→ mTLS
→ Risk
~~~

Authorization Policy 决定“谁可以调用谁”，比单纯按 IP 更符合动态 Pod 环境。

## 17. NetworkPolicy Default Deny

更安全模式：

~~~text
默认全部拒绝
→ 明确放行必要东西向流量
~~~

而不是默认所有 Pod 全互通。

## 18. Egress Control

入站安全做得好，但如果所有 Pod 可以任意访问互联网，RCE 后攻击者仍可：

- 下载工具。
- C2 通信。
- 数据外传。

需要 Egress Policy / Proxy / Firewall。

## 19. Namespace 多租户

Namespace 提供：

- 命名隔离。
- RBAC。
- Quota。
- Policy Scope。

但不是硬件级安全边界。

不可信租户通常需要更强隔离。

## 20. 多租户策略

可按风险逐步：

~~~text
Shared Namespace
→ Separate Namespace
→ Dedicated Node Pool
→ Sandbox Runtime
→ Separate Cluster
→ Separate Account/VPC
~~~

隔离越强，成本越高。

## 21. Audit Log

Kubernetes Audit 可以回答：

~~~text
谁
何时
对哪个Resource
执行了什么Verb
结果是什么
~~~

金融/政企环境尤其重要。

## 22. Break Glass

生产应保留紧急管理员通道，但必须：

- 默认关闭/严格保护。
- MFA。
- 审批。
- 短时有效。
- 全量审计。

否则“紧急账号”会成为长期后门。

## 23. Runtime Detection

Falco/eBPF 等可监测：

- 容器启动 shell。
- 异常写敏感目录。
- 访问 /etc/shadow。
- 可疑网络连接。
- Kernel 行为。

静态扫描与运行时检测要组合。

## 24. Admission 是最划算的防线

如果危险配置根本无法创建，就不需要等到运行时再救火。

典型强制：

- Non-root。
- No privileged。
- Trusted Registry。
- Signed Image。
- Resource Request/Limit。
- Required Labels。
- No hostPath。

## 25. Security as Default

Golden Path 创建新服务时应该默认带：

~~~text
Least Privilege SA
NetworkPolicy
Pod Security
Signed Image
Secret Integration
Audit Labels
~~~

安全不能靠每个开发者自己记住 30 条 Wiki。
