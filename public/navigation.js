// Public links use native navigation. No screenshots, pointer layers or delayed redirects.
addEventListener('pageshow',()=>document.body.getAnimations().forEach(animation=>animation.cancel()));
