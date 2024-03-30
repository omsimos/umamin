import PulseItem from "./components/pulse-item";

export default function Pulse() {
  return (
    <main className='mt-28 container'>
      <div className='max-w-xl mx-auto'>
        <PulseItem />
        <PulseItem />
      </div>
    </main>
  );
}
