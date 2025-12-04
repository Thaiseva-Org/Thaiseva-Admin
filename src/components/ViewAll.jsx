const ViewAll = ({ showAll, setShowAll }) => {
  return (
    <>
      {showAll === false ? (
        <div
          className="z-10 absolute bottom-0 h-[30%] left-0 w-full flex justify-center items-end rounded-md"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, #fea12f 100%)",
          }}
        >
          <button
            onClick={() => setShowAll(true)}
            className="text-[#94290c] border border-[#94290c] px-3 py-1 rounded-md font-bold mb-4"
          >
            View All
          </button>
        </div>
      ) : (
        <></>
      )}
    </>
  );
};

export default ViewAll;
