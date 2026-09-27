# 01 · 容器：从虚拟机到 Linux 进程

<div class="chapter-meta"><span>Namespace</span><span>Cgroup</span><span>OCI</span><span>OverlayFS</span></div>

## 1. 虚拟机解决了什么

一台物理服务器可以通过 Hypervisor 被拆成多个虚拟机：

```text
Physical Server
├─ VM1 → Guest OS → App A
├─ VM2 → Guest OS → App B
└─ VM3 → Guest OS → Database
```

优点是隔离强、资源利用率高，但每个 VM 都需要完整 Guest OS，启动慢、占用大。

## 2. 容器和 VM 的根本区别

虚拟机虚拟的是“整台机器”；容器隔离的是“进程运行环境”。

```text
VM:
App → Libraries → Guest OS → Hypervisor → Hardware

Container:
App → Libraries → Container Runtime → Host Kernel → Hardware
```

多个容器共享 Host Kernel，因此体积小、启动快。

## 3. 容器本质是什么

> 容器不是小型虚拟机，而是被 Linux 机制隔离和限制的普通进程。

可以近似表示：

```text
Container
=
Linux Process
+ Namespaces
+ Cgroups
+ RootFS
```

### Namespace：你“能看见什么”

常见 Namespace：

- PID：隔离进程号。
- Network：独立网卡、IP、路由。
- Mount：独立挂载视图。
- UTS：独立 hostname。
- IPC：隔离进程间通信。
- User：用户/UID 映射。

宿主机看某 Java 进程可能是 PID 21843，而容器里它认为自己是 PID 1。

### Cgroup：你“能用多少”

控制和统计：

```yaml
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: "1"
    memory: 1Gi
```

Cgroup 负责 CPU、Memory、IO 等资源边界。超过 Memory Limit 时可能被 OOM Kill。

## 4. Docker 真正解决的是交付标准化

以前经常出现：

> “在我电脑上能跑。”

Docker 把应用、依赖和运行环境封装成镜像：

```dockerfile
FROM eclipse-temurin:21-jre
COPY app.jar /app.jar
ENTRYPOINT ["java","-jar","/app.jar"]
```

得到：

```text
credit-service:1.0.0
```

开发、测试、生产运行同一个制品。

## 5. Image 为什么分层

镜像常由多个只读 Layer 组成：

```text
Ubuntu / Distroless Base
↓
JRE
↓
Application
↓
Container Writable Layer
```

共同基础层可以复用，带来构建缓存和传输效率。

运行时的可写层通常是临时的：容器删除，它也随之消失。

## 6. OverlayFS 与 Copy-on-Write

OverlayFS 把多个只读层和一个可写层合并成统一视图：

```text
Lower Layers
+
Upper Writable Layer
↓
Merged Filesystem
```

修改来自只读层的文件时，会先复制到可写层，再修改，这就是 Copy-on-Write。

因此数据库重要数据不能只放容器可写层。

## 7. OCI 为什么重要

OCI（Open Container Initiative）定义了镜像、运行时、分发等标准。

因此：

```text
Docker / Buildah / Podman
          ↓
       OCI Image
          ↓
containerd / CRI-O
          ↓
         runc
```

工具可以更换，制品仍然互通。

## 8. containerd 与 runc

现代 Kubernetes 常见链路：

```text
kubelet
↓ CRI
containerd
↓
runc
↓
Linux Kernel
```

containerd 管理镜像、容器生命周期、快照；runc 最终调用 Linux 内核创建 Namespace、Cgroup、Mount 和进程。

## 9. 不可变基础设施

不要：

```text
SSH生产服务器
→ 手工改文件
→ 手工升级依赖
```

应该：

```text
修改代码
→ CI
→ 新镜像
→ 部署新版本
→ 替换旧实例
```

这使运行环境可复现、可审计、可回滚。

## 10. 为什么容器之后一定会遇到编排问题

当容器从 10 个增长到 1000 个：

- 谁决定它们运行在哪台机器？
- 容器死了谁重建？
- 流量高时谁扩容？
- IP 变化后服务怎么发现？
- 怎么滚动发布和回滚？

这就是 Kubernetes 出现的原因。
