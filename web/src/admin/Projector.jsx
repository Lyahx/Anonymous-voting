import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api, useLive } from '../api.js';
import { CodeTiles, KineticText, swatch } from '../fx.jsx';

// Oy sayısı ve yüzde hiç gösterilmez. Birinci (berabere ise hepsi) yalnız "revealed" olunca öne çıkar.
// Puan sorusunda "birinci" olmadığı için ortalama öne çıkar.
function Podium({ poll: { type, status, result: { labels, values, average } } }) {
  const revealed = status === 'revealed';
  if (type === 'rating') {
    return revealed && average != null && <p className="podium-avg">Ortalama {average.toFixed(1)}</p>;
  }
  const top = Math.max(...values);
  const wins = revealed ? values.map((v) => v === top) : [];
  const tie = wins.filter(Boolean).length > 1;
  return (
    <>
      <ul className={`podium${revealed ? ' done' : ''}`}>
        {labels.map((label, i) => (
          <li key={i} className={wins[i] ? (tie ? 'tie' : 'win') : ''} style={{ '--c': swatch(i) }}>
            <span className="p-name">{label}</span>
          </li>
        ))}
      </ul>
      {tie && <p className="p-tie">Berabere</p>}
    </>
  );
}

export default function Projector() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const load = useCallback(() => api(`/admin/rooms/${id}`).then(setData).catch(() => {}), [id]);
  useLive(`/api/admin/rooms/${id}/events`, load, [id]);

  if (!data) return <main className="projector" />;
  const { room, polls, voters, publicUrl } = data;
  const joinUrl = `${publicUrl || location.origin}/r/${room.code}`;
  const open = polls.find((p) => p.status === 'open');
  const last = [...polls].reverse().find((p) => p.status === 'closed' || p.status === 'revealed');
  const shown = open ?? last;

  return (
    <main className="projector">
      <section className="p-join">
        <QRCodeSVG value={joinUrl} size={512} bgColor="#E4DFD3" fgColor="#0E1118" marginSize={3} style={{ width: '100%', height: 'auto' }} />
        <CodeTiles code={room.code} className="xl" />
      </section>
      <section className="p-poll">
        <p className="muted">{room.title}</p>
        {shown ? (
          <>
            <KineticText key={shown.id} text={shown.question} />
            <Podium poll={shown} />
            {shown.status !== 'revealed' && (
              <p className="muted">
                {open ? `${shown.result.total} / ${voters} katılımcı oy verdi` : 'Oylama bitti'}
              </p>
            )}
          </>
        ) : (
          <h1>{voters} katılımcı bağlandı. Oylama başlamak üzere.</h1>
        )}
      </section>
    </main>
  );
}
