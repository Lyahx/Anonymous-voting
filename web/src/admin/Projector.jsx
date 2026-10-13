import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api, useLive } from '../api.js';
import { CodeTiles, KineticText } from '../fx.jsx';

// Yalnız birinci: oy sayısı ve yüzde yok. Puan sorusunda "birinci" olmadığı için ortalama gösterilir.
function Winner({ result: { labels, values, average } }) {
  if (average != null) return <KineticText as="h2" text={`Ortalama ${average.toFixed(1)}`} />;
  const top = Math.max(...values);
  const names = labels.filter((_, i) => values[i] === top);
  return (
    <>
      {names.length > 1 && <p className="muted">Berabere</p>}
      {names.map((n) => <KineticText key={n} as="h2" text={n} />)}
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
            {shown.status === 'revealed' ? (
              <Winner result={shown.result} />
            ) : (
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
