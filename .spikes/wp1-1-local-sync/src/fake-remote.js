const copy = (value) => structuredClone(value);

export class FakeRemote {
  records = new Map();
  operations = new Map();
  transientFailures = 0;
  logicalWrites = 0;
  lostAcknowledgements = 0;

  failNext(count = 1) {
    this.transientFailures = count;
  }

  loseNextAcknowledgement(count = 1) {
    this.lostAcknowledgements = count;
  }

  recordKey(ownerId, profileId) {
    return `${ownerId}:${profileId}`;
  }

  readProfile(id, ownerId = "owner-1") {
    const profile = this.records.get(this.recordKey(ownerId, id));
    return profile ? copy(profile) : null;
  }

  async push(operation) {
    if (operation.ownerId !== operation.candidate.ownerId) {
      return { status: "owner-mismatch" };
    }

    const previous = this.operations.get(operation.operationId);
    if (previous) {
      if (JSON.stringify(previous.operation) !== JSON.stringify(operation)) {
        return { status: "idempotency-key-reused" };
      }
      return { status: "duplicate", profile: copy(previous.profile) };
    }

    if (this.transientFailures > 0) {
      this.transientFailures -= 1;
      return { status: "transient-failure" };
    }

    const key = this.recordKey(operation.ownerId, operation.profileId);
    const current = this.records.get(key);
    const currentRevision = current?.revision ?? null;
    if (currentRevision !== operation.baseRevision) {
      return {
        status: "conflict",
        remoteCandidate: current ? copy(current) : null,
      };
    }

    const profile = copy(operation.candidate);
    this.records.set(key, profile);
    this.operations.set(operation.operationId, {
      operation: copy(operation),
      profile: copy(profile),
    });
    this.logicalWrites += 1;

    if (this.lostAcknowledgements > 0) {
      this.lostAcknowledgements -= 1;
      throw new Error("Simulated acknowledgement loss after remote acceptance");
    }
    return { status: "accepted", profile: copy(profile) };
  }

  compete(profileId, name, ownerId = "owner-1") {
    const key = this.recordKey(ownerId, profileId);
    const current = this.records.get(key);
    if (!current) throw new Error("Cannot compete with a missing remote profile");
    const profile = {
      ...current,
      name,
      revision: current.revision + 1,
      updatedAt: new Date(0).toISOString(),
    };
    this.records.set(key, profile);
    return copy(profile);
  }

  reset() {
    this.records.clear();
    this.operations.clear();
    this.transientFailures = 0;
    this.logicalWrites = 0;
    this.lostAcknowledgements = 0;
  }
}
