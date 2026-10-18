import { useState } from 'react';
import { ArrowElbowDownLeft } from '@phosphor-icons/react';
import { MARKERS, type Marker } from '../../db/db';
import { addManualClip } from '../../db/clips';

/** Eklentisiz hızlı kayıt: yaz ya da yapıştır, Enter. Shift+Enter yeni satır. */
export function QuickCapture() {
    const [text, setText] = useState('');
    const [color, setColor] = useState<Marker>('lime');

    const submit = async () => {
        if (!text.trim()) return;
        await addManualClip(text, color);
        setText('');
    };

    return (
        <form
            className="quick"
            onSubmit={(e) => {
                e.preventDefault();
                void submit();
            }}
        >
            <label className="visually-hidden" htmlFor="quick-input">
                Hızlı kesit
            </label>
            <textarea
                id="quick-input"
                className="quick__input"
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void submit();
                    }
                }}
                placeholder="Bir şey yaz ya da yapıştır — bağlantı ve #etiket de olur"
            />
            <div className="quick__side">
                <div className="quick__swatches" role="group" aria-label="Kalem rengi">
                    {MARKERS.map((m) => (
                        <button
                            type="button"
                            key={m}
                            className="swatch"
                            data-c={m}
                            aria-pressed={color === m}
                            aria-label={m}
                            onClick={() => setColor(m)}
                        />
                    ))}
                </div>
                <button className="btn btn--hi" type="submit" disabled={!text.trim()}>
                    Kes <ArrowElbowDownLeft size={16} weight="bold" />
                </button>
            </div>
        </form>
    );
}
