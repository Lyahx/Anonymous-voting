import '@fontsource-variable/bricolage-grotesque/wdth.css';
import '@fontsource-variable/source-serif-4';
import './styles.css';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Ambient, Cursor } from './fx.jsx';
import Home from './pages/Home.jsx';
import Room from './pages/Room.jsx';
import Login from './admin/Login.jsx';
import Rooms from './admin/Rooms.jsx';
import AdminRoom from './admin/Room.jsx';
import Projector from './admin/Projector.jsx';

function Shell() {
  const loc = useLocation();
  return (
    <>
      <Ambient />
      <Cursor />
      {/* key: rota değişince sayfa yeniden girer */}
      <div key={loc.pathname} className="page">
        <Routes location={loc}>
          <Route path="/" element={<Home />} />
          <Route path="/r/:code" element={<Room />} />
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin" element={<Rooms />} />
          <Route path="/admin/rooms/:id" element={<AdminRoom />} />
          <Route path="/admin/rooms/:id/projector" element={<Projector />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </div>
    </>
  );
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Shell />
  </BrowserRouter>,
);
