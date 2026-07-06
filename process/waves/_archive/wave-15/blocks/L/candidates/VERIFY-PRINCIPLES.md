3. A compliance-invariant test must call the real service or guard, not re-implement or mock the mechanism it proves.
   Why: A mocked or re-implemented mechanism passes whether the real guard is correct or broken.
