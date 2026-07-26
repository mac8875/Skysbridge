const { json, authenticatedUser, sendMail } = require('./_shared');

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
})[character]);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const { client, user } = await authenticatedUser(event, false);
    const { postId, shareWithProfessional } = JSON.parse(event.body || '{}');
    if (!postId) throw new Error('Missing post ID.');
    if (shareWithProfessional !== true) return json(200, { ok: true, emailSent: false, skipped: true, reason: 'Consent not given' });

    const { data: post, error } = await client
      .from('group_posts')
      .select('id,group_id,user_id,author_name,body,created_at,email_forwarded_at,support_groups(name,forward_messages_to_email)')
      .eq('id', postId)
      .single();

    if (error || !post) throw new Error('Room message not found.');
    if (post.user_id !== user.id) throw new Error('You may only forward your own newly created message.');
    if (!post.support_groups?.forward_messages_to_email) return json(200, { ok: true, emailSent: false, skipped: true });
    if (post.email_forwarded_at) return json(200, { ok: true, emailSent: true, duplicate: true });

    const { data: membership, error: membershipError } = await client
      .from('group_members')
      .select('status')
      .eq('group_id', post.group_id)
      .eq('user_id', user.id)
      .single();
    if (membershipError || membership?.status !== 'approved') throw new Error('Approved room membership required.');

    const destination = process.env.ROOM_MESSAGE_FORWARD_TO || process.env.ADMIN_EMAIL || process.env.M365_SENDER_EMAIL;
    const roomName = post.support_groups?.name || 'Protected room';
    const authorName = post.author_name || user.email?.split('@')[0] || 'Community member';
    const createdAt = new Date(post.created_at).toLocaleString('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' });
    const subject = `Sky's Bridge — New message in ${roomName}`;
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;max-width:720px">
      <h2>Optional professional-support request from “${escapeHtml(roomName)}”</h2>
      <p><strong>Author:</strong> ${escapeHtml(authorName)}<br>
      <strong>Account:</strong> ${escapeHtml(user.email || 'Not available')}<br>
      <strong>Time:</strong> ${escapeHtml(createdAt)} UTC</p>
      <div style="white-space:pre-wrap;border-left:3px solid #b89535;padding:12px 16px;background:#f7f4ec">${escapeHtml(post.body)}</div>
      <p style="font-size:12px;color:#666">Confidential: the member explicitly chose to share this protected-room message with a Sky's Bridge grief professional. Handle it according to your privacy and professional-support procedures. Do not forward it beyond the authorised support team without an appropriate lawful basis.</p>
    </div>`;

    const emailSent = await sendMail({ to: destination, subject, html, replyTo: user.email || undefined });
    if (emailSent) {
      await client.from('group_posts').update({ email_forwarded_at: new Date().toISOString() }).eq('id', post.id);
    }
    return json(200, { ok: true, emailSent });
  } catch (error) {
    return json(400, { ok: false, error: error.message });
  }
};
