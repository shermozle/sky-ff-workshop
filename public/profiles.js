// Synthetic workshop fixtures, shared by the browser app and presenter seed script.
(function (root) {
  const profiles = [
    { id: 'sky-workshop-aroha', name: 'Aroha', initials: 'AR', colour: '#a8dcba', packages: ['Sky Starter', 'Sky Sport'], genre: 'Sport', engagement: 'high', tenure: 36, watches: 18 },
    { id: 'sky-workshop-ben', name: 'Ben', initials: 'BE', colour: '#a9cfff', packages: ['Sky Starter', 'Sky Movies'], genre: 'Movies', engagement: 'high', tenure: 14, watches: 12 },
    { id: 'sky-workshop-casey', name: 'Casey', initials: 'CA', colour: '#efbcff', packages: ['Sky Starter', 'Sky Entertainment'], genre: 'Drama', engagement: 'low', tenure: 1, watches: 2 },
    { id: 'sky-workshop-dev', name: 'Dev', initials: 'DE', colour: '#ffd697', packages: ['Sky Starter', 'Sky Entertainment', 'Sky Sport', 'Sky Movies'], genre: 'Sport', engagement: 'high', tenure: 48, watches: 22 },
    { id: 'sky-workshop-ellis', name: 'Ellis', initials: 'EL', colour: '#f9b7c1', packages: ['Sky Starter'], genre: 'Documentary', engagement: 'low', tenure: 9, watches: 1 }
  ];
  const properties = p => ({ subscription_packages: p.packages, favourite_genre: p.genre, engagement_level: p.engagement, tenure_months: p.tenure, workshop_dataset: 'sky-ff-v1' });
  const data = { profiles, properties };
  if (typeof module !== 'undefined') module.exports = data;
  else root.SkyProfiles = data;
})(typeof window !== 'undefined' ? window : globalThis);
