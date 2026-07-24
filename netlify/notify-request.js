const { json, authenticatedUser, sendMail } = require('./_shared');
exports.handler = async (event) => {
  if(event.httpMethod!=='POST') return json(405,{error:'Method not allowed'});
  try{
    const {client,user}=await authenticatedUser(event,false); const {requestType,requestId}=JSON.parse(event.body||'{}');
    let title='',detail='';
    if(requestType==='membership'){
      const {data,error}=await client.from('group_members').select('group_id,user_id,status,support_groups(name)').eq('group_id',requestId).eq('user_id',user.id).single(); if(error||!data||data.status!=='pending') throw new Error('Pending room request not found.');
      title='New protected-room request'; detail=`${user.email} requested access to ${data.support_groups?.name||'a protected room'}.`;
    }else if(requestType==='memorial'){
      const {data,error}=await client.from('memorials').select('user_id,child_name,public_requested').eq('id',requestId).single(); if(error||data.user_id!==user.id) throw new Error('Memorial request not found.');
      title='New memorial awaiting review'; detail=`${user.email} submitted a memorial for ${data.child_name}${data.public_requested?' and requested publication on the Wall of Stars':''}.`;
    }else if(requestType==='memory'){
      const {data,error}=await client.from('memories').select('user_id,author_name,message').eq('id',requestId).single(); if(error||data.user_id!==user.id) throw new Error('Memory request not found.');
      title='New memory awaiting review'; detail=`${user.email} submitted a memory as ${data.author_name}.`;
    }else throw new Error('Unknown request type.');
    const adminEmail=process.env.ADMIN_EMAIL||'together@skysbridge.org';
    const emailSent=await sendMail({to:adminEmail,subject:`Sky's Bridge — ${title}`,html:`<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${title}</h2><p>${detail}</p><p>Log in to Sky's Bridge with your administrator account and open the Community review centre.</p></div>`});
    return json(200,{ok:true,emailSent});
  }catch(error){return json(400,{ok:false,error:error.message});}
};
