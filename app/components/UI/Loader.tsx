const Loader = () => {
  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-[#0a8b9b] to-[#153f43] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-pulse">
          <img
            src="/logo-short-green.webp"
            alt="Even Logo"
            className="size-24 md:size-28 lg:size-32 justify-self-center"
          />
        </div>
      </div>
    </div>
  );
};

export default Loader;
