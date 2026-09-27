# 20 · 交付高级：供应链门禁、GitOps 漂移、渐进式发布、Feature Flag 与数据库演进

<div class="chapter-meta"><span>Supply Chain</span><span>GitOps</span><span>Progressive Delivery</span><span>Feature Flag</span></div>

## 1. SAST / Dependency Scan / Image Scan

### SAST
分析源码逻辑漏洞。

### Dependency Scan
检查 Maven/npm/pip/Go modules 等依赖的已知 CVE。

### Image Scan
扫描最终镜像中的 OS Package、Runtime、Library 与 App Dependency。

三者关注层次不同，不能互相替代。

## 2. Secret Scan

应阻止 Access Key、Token、Private Key、Password 进入 Git。

如果 Secret 已经进历史，删除当前文件并不够，必须 Rotation。

## 3. Build Provenance

除了 SBOM 回答“里面有什么”，还要回答：

~~~text
哪个源码？
哪个Commit？
哪个Builder？
哪次Workflow？
什么参数？
~~~

这就是 Provenance/SLSA 的关注点。

## 4. Immutable Artifact

不要让同一个 tag 指向不同内容。

生产更适合使用：

~~~text
image@sha256:digest
~~~

保证同一声明永远是同一字节内容。

## 5. GitOps Drift

Git：

~~~text
replicas=3
~~~

线上被手改：

~~~text
replicas=8
~~~

GitOps Controller 应识别 OutOfSync，并按策略恢复或告警。

## 6. Self-Heal 双刃剑

自动恢复手改配置很强，但如果 Git 本身错误，错误也会被自动坚定执行。

因此必须有：

- PR Review。
- Policy。
- Preview。
- Progressive Delivery。

## 7. Promotion

Dev → Staging → Prod 应尽量使用同一 Image Digest，只变环境配置和 Git Promotion，而不是每个环境重新 Build。

## 8. Canary 指标

Technical：

- Error Rate。
- P99。
- Restart。
- Saturation。

Business：

- 审批成功率。
- 支付成功率。
- 转化率。
- 异常订单率。

业务指标异常时，即使全是 HTTP 200，也必须停止发布。

## 9. 自动 Abort

~~~text
v2 5%
→ P99 +20%
→ approval rate -30%
→ Abort/Rollback
~~~

渐进式发布的价值是把风险控制数据化。

## 10. Blue-Green

Blue=v1，Green=v2，两套同时准备，确认后切流量。

优点是切换/回滚快，代价是资源成本高。

## 11. Rolling 混部

Rolling 期间 v1/v2 同时存在，因此 API、DB Schema、Event Schema 都要兼容混部窗口。

## 12. Expand / Contract

### Expand
增加新字段，新旧版本都能工作。

### Migrate
回填数据，观察。

### Contract
旧版本完全退出后删除旧字段。

这是 Rollout 可回滚的基础。

## 13. API Versioning

Breaking Change 必须显式治理：

~~~text
/v1
/v2
~~~

或 Header/Schema 版本。

内部 API 同样需要兼容管理。

## 14. Event Schema Evolution

Kafka 历史消息可能长期存在，因此：

- 新增字段尽量向后兼容。
- 不随意改变字段含义。
- 加 Schema Version。
- 必要时使用 Schema Registry。

## 15. Feature Flag

~~~text
Deploy ≠ Release
~~~

代码可以已上线，但功能只对内部/1%/某 Region 开启。

## 16. Feature Flag Debt

临时 Flag 必须有 Owner、Expire Date、删除计划，否则代码会积累大量不可理解分支。

## 17. Rollback 不只是镜像

可能涉及：

- App。
- Config。
- Feature Flag。
- DB Schema。
- Event Schema。
- Infra。

所以回滚能力必须提前设计。

## 18. CI/CD 权限

优先 OIDC + 短期 Token + 最小权限，避免长期 Cloud Access Key/kubeconfig 藏在 CI Secret。

## 19. GitOps Production Access

~~~text
CI不直接进Prod
GitOps Controller在Cluster内Pull
~~~

减少 CI 被攻破后直接控制生产的路径。

## 20. Release Evidence

关键变更应能回答：

~~~text
哪个Commit？
哪个Digest？
谁批准？
哪些测试通过？
SBOM是什么？
签名是什么？
Canary指标如何？
~~~

这才是可审计交付。
