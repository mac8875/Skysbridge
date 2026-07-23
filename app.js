
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');

function toggleMenu(){
  document.querySelector('nav').classList.toggle('open');
}
function closeModal(){
  modal.classList.remove('open');
}
function openJoin(){
  modalContent.innerHTML = `
    <p class="eyebrow">Protected access</p>
    <h2 style="font-size:2.35rem">Join at your own pace</h2>
    <p class="muted">This first public version is a prototype. No real account is created yet.</p>
    <div class="notice">The live platform will include consent controls, moderator approval, privacy settings and country-specific support resources.</div>
    <form class="form" onsubmit="event.preventDefault(); alert('Thank you. This prototype does not yet store registrations.'); closeModal();">
      <input type="email" placeholder="Email address" required>
      <input placeholder="Community name (real name not required)">
      <select><option>I am a parent</option><option>I am a partner</option><option>I am a relative</option><option>I am a professional supporter</option></select>
      <button class="btn btn-primary">Request early access</button>
    </form>`;
  modal.classList.add('open');
}
function openStar(){
  modalContent.innerHTML = `
    <p class="eyebrow">Wall of Stars</p>
    <h2 style="font-size:2.35rem">Create a star</h2>
    <p class="muted">You control the name, story, image and visibility. Nothing is published without confirmation.</p>
    <form class="form" onsubmit="event.preventDefault(); alert('Preview saved locally in this prototype only.'); closeModal();">
      <input placeholder="Child's name or family nickname" required>
      <textarea rows="4" placeholder="A short remembrance, story or letter"></textarea>
      <select>
        <option>Save privately</option>
        <option>Private link</option>
        <option>Members only</option>
        <option>Public on the Wall of Stars</option>
      </select>
      <label><input type="checkbox" required style="width:auto"> I understand that I control publication and may remove the memorial later.</label>
      <button class="btn btn-primary">Save preview</button>
    </form>`;
  modal.classList.add('open');
}
function showStar(name, text, visibility){
  modalContent.innerHTML = `
    <div style="font-size:3.3rem;color:#d6ad59">✦</div>
    <p class="eyebrow">${visibility}</p>
    <h2 style="font-size:2.7rem">${name}</h2>
    <p class="muted">${text}</p>
    <button class="btn btn-primary" onclick="closeModal()">Close</button>`;
  modal.classList.add('open');
}
modal.addEventListener('click', e => { if(e.target === modal) closeModal(); });
