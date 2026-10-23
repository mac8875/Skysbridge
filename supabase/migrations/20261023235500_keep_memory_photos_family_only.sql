-- Memory photos remain private even when their written memory is approved for a public star.
-- Only the star owner, accepted family, and authorized moderators may read them.
drop policy if exists "Public approved memory photos are readable" on storage.objects;

notify pgrst, 'reload schema';
