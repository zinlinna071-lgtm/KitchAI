/* Auto-grow the preview chat input until its maximum height, then scroll internally. */
(()=> {
  const maxHeight=160;
  function resizeComposer(input){
    if(!(input instanceof HTMLTextAreaElement)||input.id!=="chat-input")return;
    input.style.height="auto";
    const nextHeight=Math.min(input.scrollHeight,maxHeight);
    input.style.height=nextHeight+"px";
    const shouldScroll=input.scrollHeight>maxHeight;
    input.classList.toggle("is-scrollable",shouldScroll);
    input.style.overflowY=shouldScroll?"auto":"hidden";
  }
  document.addEventListener("input",event=>resizeComposer(event.target));
  document.addEventListener("focusin",event=>resizeComposer(event.target));
  document.addEventListener("click",event=>{
    const prompt=event.target instanceof Element?event.target.closest("[data-prompt]"):null;
    if(!prompt)return;
    requestAnimationFrame(()=>resizeComposer(document.querySelector("#chat-input")));
  });
  window.addEventListener("resize",()=>resizeComposer(document.querySelector("#chat-input")));
})();
