# Skysbridge — Administrator Star Delete Update

This update restores management of already published memorial stars without replacing the current Wall of Stars or the main `app.js`.

## Files to add

Copy these files into the matching folders of the Skysbridge repository:

- `js/admin-star-delete.js`
- `supabase/migrations/20260801181500_admin_delete_published_memorial.sql`

## One line to add to `index.html`

At the bottom of `index.html`, immediately after the existing `js/app.js` script, add:

```html
<script src="js/admin-star-delete.js?v=35-1"></script>
```

The final section should look similar to this:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/config.js"></script>
<script src="js/app.js"></script>
<script src="js/admin-star-delete.js?v=35-1"></script>
</body>
</html>
```

Keep the version numbers already present on `config.js` and `app.js`; only add the new line.

## Database migration

If the Supabase GitHub integration automatically runs files in `supabase/migrations`, committing the update is sufficient.

Otherwise, open Supabase → SQL Editor and run the contents of:

`supabase/migrations/20260801181500_admin_delete_published_memorial.sql`

## Result

After deployment:

1. Sign in with the administrator account.
2. Open the Community administrator area.
3. A new card named **Published stars** appears.
4. Select **Delete star** and confirm the permanent deletion.

Sky's fixed first star remains protected because it is not part of the published memorial list.
