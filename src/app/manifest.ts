import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return { id:'/', name:'EDVA Control App', short_name:'EDVA', description:'Control operativo y avisos EDVA',
    start_url:'/promoter', scope:'/', display:'standalone', background_color:'#fff7f8', theme_color:'#e52542',
    icons:[{src:'/meal-icon-192.png',sizes:'192x192',type:'image/png'},{src:'/meal-icon-512.png',sizes:'512x512',type:'image/png'}] };
}
