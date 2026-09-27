# Changelog

## V2 · Full Knowledge Edition — 2026-09-28

### Why

V1 established the complete cloud-native backbone, but several topics discussed in the learning conversation were compressed when moved into the repository. V2 keeps the original mainline and adds full mechanism-level deep dives rather than replacing them with summaries.

### Added

- Traffic entry deep dive: DNS, CDN, WAF, load balancing algorithms, Ingress Controller, Gateway API, client IP.
- Kubernetes internals: Reflector, DeltaFIFO, Informer, Indexer, WorkQueue, Pod Sandbox, control-plane HA, leader election, finalizers.
- Packet-path networking: DNAT/SNAT, conntrack, iptables/IPVS/eBPF, NodePort/LoadBalancer/Headless, Sidecar/Ambient Mesh.
- Storage internals: CSI controller/node split, topology, WaitForFirstConsumer, RWO/RWX semantics, Ceph PG/CRUSH, snapshot consistency, PITR.
- Dedicated Redis chapter: cache consistency, penetration/breakdown/avalanche, hot/big keys, locks, renewal, fencing.
- Dedicated Kafka chapter: leaders/followers, ISR, acks, at-most/at-least/exactly-once, transactions, rebalance, lag, DLQ.
- Reliability and distributed transaction deep dive: timeout budgets, Little's Law, retry storms, bulkheads, TCC, Saga, Inbox/Outbox.
- Advanced observability: Alertmanager, exemplars, tail sampling, Kubernetes Events, OOM/throttling, continuous profiling, Thanos.
- Advanced delivery: supply-chain gates, GitOps drift, progressive delivery, feature flags, API/event schema evolution.
- Kubernetes workload/resource governance: DaemonSet, Job/CronJob, QoS, LimitRange, ResourceQuota, PDB, graceful shutdown, priority/preemption, HPA/VPA/KEDA.
- HA/capacity/Chaos Engineering and incident practices.
- Advanced security: workload identity, KMS, secret rotation, seccomp, capabilities, sandbox runtimes, SPIFFE, multi-tenancy.
- Full production troubleshooting Runbook.

### Site

- Navigation expanded from 12 to 25 chapters.
- Existing 00–11 chapters remain as the primary structured learning path.
- 12–24 are mechanism-level deep dives.
