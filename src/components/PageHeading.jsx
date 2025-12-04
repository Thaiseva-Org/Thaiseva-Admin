const PageHeading = ({ text, subtitle, icon }) => {
  return (
    <div className="mb-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        {icon && (
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white shadow-lg">
            {icon}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary-700 via-primary-600 to-primary-500 bg-clip-text text-transparent">
            {text}
          </h1>
          {subtitle && (
            <p className="text-sm text-neutral-600 mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="h-1 w-20 bg-gradient-to-r from-primary-500 to-primary-700 rounded-full"></div>
    </div>
  );
};

export default PageHeading;
