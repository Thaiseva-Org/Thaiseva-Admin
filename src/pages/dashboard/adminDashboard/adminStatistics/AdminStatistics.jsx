// import { useContext } from "react";
import PageHeading from "../../../../components/PageHeading";
// import { PartnerContext } from "../../../../contextAPIs/PartnerProvider";
import AllStatistics from "./childs/AllStatistics";

const AdminStatistics = () => {
  // const { logo, categories, setRefetch, contactInfo, partnerPayments } =
  //   useContext(PartnerContext);
  // const months = [
  //   "January",
  //   "February",
  //   "March",
  //   "Appril",
  //   "May",
  //   "June",
  //   "July",
  //   "Augast",
  //   "September",
  //   "October",
  //   "November",
  //   "December",
  // ];

  return (
    <div>
      <PageHeading text="Admin Statistics" />

      <div>
        <AllStatistics />
        {/* <Bar options={options} data={data} /> */}
        {/* <HotelsStatistics /> */}
      </div>
    </div>
  );
};

export default AdminStatistics;
