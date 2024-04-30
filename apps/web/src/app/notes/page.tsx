import { NoteItem } from "./components/note-item";

export default function Pulse() {
  return (
    <main className="mt-28 container">
      <div className="max-w-xl mx-auto gap-5 flex flex-col">
        <NoteItem />
        <NoteItem />
      </div>
    </main>
  );
}
