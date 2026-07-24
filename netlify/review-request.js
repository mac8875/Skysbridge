const { json, authenticatedUser, sendMail } = require('./_shared');
exports.handler = async (event) => {
  if(event.httpMethod!=='POST') return json(405,{error:'Method not allowed'});
  try{
    const {client,user:admin}=await authenticatedUser(event,true); const {requestType,requestId,decision,reason}=JSON.parse(event.body||'{}');
    if(!['approve','decline'].includes(decision)) throw new Error('Invalid decision.');
    let applicantId,subject,message;
    if(requestType==='membership'){
      const [groupId,userId]=String(requestId).split(':'); const {data:group}=await client.from('support_groups').select('name').eq('id',groupId).single();
      const {data,error}=await client.from('group_members').update({status:decision==='approve'?'approved':'blocked',reviewed_at:new Date().toISOString(),reviewed_by:admin.id}).eq('group_id',groupId).eq('user_id',userId).eq('status','pending').select('user_id').single(); if(error) throw error; applicantId=data.user_id;
      subject=`Your Sky's Bridge room request was ${decision==='approve'?'approved':'reviewed'}`; message=decision==='approve'?`You now have access to ${group?.name||'the protected room'}. Log in to enter the room.`:`Your request for ${group?.name||'the protected room'} was not approved at this time. ${reason||''}`;
    }else if(requestType==='memorial'){
      const {data,error}=await client.from('memorials').update({approved:decision==='approve',rejection_reason:decision==='decline'?(reason||'Not approved at this time.'):null,reviewed_at:new Date().toISOString(),reviewed_by:admin.id}).eq('id',requestId).select('user_id,child_name').single(); if(error) throw error; applicantId=data.user_id;
      subject=`Your memorial for ${data.child_name} has been reviewed`; message=decision==='approve'?`The memorial for ${data.child_name} has been approved. If public display was requested, it can now appear on the Wall of Stars.`:`The memorial for ${data.child_name} was not approved at this time. ${reason||''}`;
    }else if(requestType==='memory'){
      const {data,error}=await client.from('memories').update({approved:decision==='approve',rejection_reason:decision==='decline'?(reason||'Not approved at this time.'):null,reviewed_at:new Date().toISOString(),reviewed_by:admin.id}).eq('id',requestId).select('user_id').single(); if(error) throw error; applicantId=data.user_id;
      subject=`Your Sky's Bridge memory has been reviewed`; message=decision==='approve'?'Your memory has been approved and can now be displayed.':`Your memory was not approved at this time. ${reason||''}`;
    }else throw new Error('Unknown request type.');
    const {data:userData}=await client.auth.admin.getUserById(applicantId); const applicantEmail=userData?.user?.email; let emailSent=false;
    if(applicantEmail) emailSent=await sendMail({to:applicantEmail,subject:`Sky's Bridge — ${subject}`,html:`<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${subject}</h2><p>${message}</p><p>With care,<br>Sky's Bridge</p></div>`});
    return json(200,{ok:true,emailSent});
  }catch(error){return json(400,{ok:false,error:error.message||String(error)});}
};
