export default function MdxLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-xl container min-h-screen lg:mt-36 mt-28 pb-24">
      {children}
    </div>
  );
}
