'use client';

import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Button,Dialog,DialogActions,DialogContent,DialogContentText,DialogTitle} from '@mui/material';

export default function UnsavedChanges({active,onLeave}:{active:boolean;onLeave:()=>void}) {
  const router=useRouter();
  const [destination,setDestination]=useState('');
  useEffect(()=>{
    if(!active)return;
    function intercept(event:MouseEvent) {
      if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const anchor=(event.target as Element|null)?.closest('a[href]');
      if(!(anchor instanceof HTMLAnchorElement)||anchor.hasAttribute('download')||(anchor.target&&anchor.target!=='_self'))return;
      const url=new URL(anchor.href,window.location.href);
      if(url.origin!==window.location.origin || (url.pathname===window.location.pathname&&url.search===window.location.search))return;
      event.preventDefault();
      setDestination(url.pathname+url.search+url.hash);
    }
    document.addEventListener('click',intercept,true);
    return ()=>document.removeEventListener('click',intercept,true);
  },[active]);
  function leave() { const href=destination;setDestination('');onLeave();router.push(href); }
  return <Dialog open={!!destination} onClose={()=>setDestination('')} maxWidth="sm" fullWidth aria-labelledby="unsaved-title"><DialogTitle id="unsaved-title">Анкета ещё не отправлена</DialogTitle><DialogContent><DialogContentText>При переходе заполненные поля и выбранные фотографии будут потеряны. Остаться и закончить анкету?</DialogContentText></DialogContent><DialogActions><Button onClick={()=>setDestination('')}>Остаться</Button><Button onClick={leave} variant="contained">Уйти со страницы</Button></DialogActions></Dialog>;
}
