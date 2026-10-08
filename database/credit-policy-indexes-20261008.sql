create index if not exists credit_allocations_bucket_idx
  on private.credit_allocations(bucket_id);

create index if not exists credit_allocations_user_idx
  on private.credit_allocations(user_id);
