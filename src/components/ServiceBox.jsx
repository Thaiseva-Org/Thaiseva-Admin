import DeleteButton from "./DeleteButton";
import UpdateButton from "./UpdateButton";

const ServiceBox = ({
  category,
  handleDeleteCategory,
  handleUpdateCategory,
}) => {
  return (
    <div className="relative">
      <div className="flex flex-col items-center justify-center rounded-lg shadow-[0_0_7px_rgba(0,0,0,0.1)]  gap-[0.1rem]">
        <div className="flex justify-center items-center w-full h-24 rounded-t-lg bg-[var(--image-bg-color)]">
          <img
            src={category?.image}
            alt=""
            className="w-16 aspect-square object-cover"
          />
        </div>
        <h3 className="text-md w-full text-[var(--image-text-color)] bg-[var(--image-text-bg-color)] text-center rounded-b-lg p-1 text-sm px-2 overflow-hidden">
          {category?.title}
        </h3>
      </div>
      <div
        onClick={() => handleUpdateCategory(category.id)}
        className="absolute top-1 right-10 "
      >
        <UpdateButton />
      </div>
      <div
        onClick={() => handleDeleteCategory(category.id)}
        className="absolute top-1 right-1 "
      >
        <DeleteButton />
      </div>
    </div>
  );
};

export default ServiceBox;
