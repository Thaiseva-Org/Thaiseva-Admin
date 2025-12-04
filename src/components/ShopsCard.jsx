import { useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase/firebase.config";
import DeleteButton from "./DeleteButton";
import UpdateButton from "./UpdateButton";

const ShopsCard = ({
  shop,
  type = "shop",
  setRefetch = () => {},
  setShop = () => {},
  setOpenModal = () => {},
  setIsUpdate = () => {},
}) => {
  const [loading, setLoading] = useState(false);
  const deleteShop = async () => {
    if (
      confirm(
        `Are you sure you want to delete this ${
          type === "shop" ? "shop" : "club"
        }?`
      )
    ) {
      await deleteDoc(
        doc(db, `${type === "shop" ? "shops" : "clubs"}`, shop.id)
      ).then(() => {
        alert(`${type === "shop" ? "Shop" : "Club"} deleted successfully!`);
        setRefetch((p) => !p);
        setLoading(false);
      });
    }
  };
  const setItem = () => {
    setShop(shop);
    setIsUpdate(true);
    setOpenModal(true);
  };
  return (
    <div className="text-black bg-white relative shadow-[0_0_5px_rgba(0,0,0,0.1)] w-full xl:w-[49%] rounded-md p-3 flex items-center">
      <button
        disabled={loading}
        className="absolute right-10 top-0 mr-4 mt-4"
        onClick={() => setItem()}
      >
        <UpdateButton
          title={`Update this ${type === "shop" ? "shop" : "club"}`}
        />
      </button>
      <button
        disabled={loading}
        className="absolute right-0 top-0 mr-4 mt-4"
        onClick={() => deleteShop()}
      >
        <DeleteButton
          title={`Delete this ${type === "shop" ? "shop" : "club"}`}
        />
      </button>
      <div className="mr-3">
        <img
          loading="lazy"
          src={shop.imageUrl}
          alt=""
          className="w-40 max-md:w-28 aspect-square rounded select-none object-cover"
        />
      </div>
      <div className="w-[calc(100%-10.75rem)] max-md:w-[calc(100%-7.75rem)] h-40 flex items-center flex-col">
        <div className="h-[3rem] w-full flex items-center">
          <p className="text-xl font-bold w-[70%] truncate text-left">
            {shop.name}
          </p>
        </div>
        <p className="w-full h-[5rem] truncate-text m-auto text-sm text-gray-900">
          {shop.description}
        </p>
        <div className="h-[2rem] w-full flex items-center justify-end">
          <p className="text-xs text-gray-700 text-right truncate w-[80%]">
            {shop.address}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShopsCard;
