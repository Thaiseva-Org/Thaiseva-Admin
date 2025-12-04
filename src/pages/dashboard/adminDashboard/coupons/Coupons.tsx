import { doc, onSnapshot, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { couponsCollection, db } from "../../../../firebase/firebase.config";
import PageHeading from "../../../../components/PageHeading";
import VoucherGenerator from "voucher-code-generator";
import {
  Button,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  TextField,
  MobileStepper,
  MenuItem,
} from "@mui/material";
import { successNotification } from "../../../../utils/utils";

const currencies = [
  {
    name: "Rupees (₹)",
    code: "INR",
  },
  {
    name: "USD ($)",
    code: "USD",
  },
  {
    name: "Bhatt (฿)",
    code: "THB",
  },
];

interface Coupon {
  code: string;
  discount: number;
  type: string;
  limit?: number | string;
  availableFor: string | string[];
  upto?: number;
  min?: number;
}

const Coupons = () => {
  const [openAdd, setOpenAdd] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [newCoupon, setNewCoupon] = useState<Coupon>({
    discount: 0,
    limit: 10,
    min: 100,
    upto: 125,
    code: VoucherGenerator.generate({
      length: 6,
    }).toString(),
    type: "all",
    availableFor: "all",
  });
  const [step, setStep] = useState(0);
  // useEffect(() => {
  //   const unsub = onSnapshot(couponsCollection, (snapshot) => {
  //     let newCoupns: Coupon[] = [];
  //     snapshot.docs.forEach((doc) => {
  //       newCoupns.push(doc.data() as Coupon);
  //     });
  //     setCoupons(newCoupns);
  //   });
  //   return () => unsub();
  // }, []);
  const handleAddClose = () => {
    setOpenAdd(false);
    setStep(0);
  };
  const handleAddSubmit = async () => {
    await setDoc(doc(db, "coupons", newCoupon.code), newCoupon).then((res) => {
      successNotification("Coupon added successfully");
      setOpenAdd(false);
    });
  };
  const [curr, setCurr] = useState(0);
  const step1 = (
    <>
      <div style={{ marginTop: "1em", display: "flex", flexDirection: "row" }}>
        <TextField
          fullWidth
          sx={{}}
          label="Code"
          value={newCoupon.code}
          onChange={(e) =>
            setNewCoupon((p) => ({ ...p, code: e.target.value }))
          }
        />
        <Button
          variant="outlined"
          sx={{ width: "250px", marginLeft: "1em" }}
          onClick={() =>
            setNewCoupon((p) => ({
              ...p,
              code: VoucherGenerator.generate({ length: 6 }).toString(),
            }))
          }
        >
          Auto Generate
        </Button>
      </div>
      <div
        style={{
          marginTop: "1em",
          display: "flex",
          flexDirection: "row",
          gap: "1em",
        }}
      >
        <TextField fullWidth label="Discount" type="number" />
        <TextField fullWidth label="Limit" type="number" />
      </div>
      <div
        style={{
          marginTop: "1em",
          display: "flex",
          flexDirection: "row",
          gap: "1em",
        }}
      >
        <TextField fullWidth label="Min Price" type="number" />
        <TextField fullWidth label="Discount Upto" type="number" />
      </div>
    </>
  );
  const step2 = (
    <>
      <div>
        <TextField select label="Type" fullWidth>
          <MenuItem value={"All"}>All</MenuItem>
          <MenuItem value={"Restaurant"}>Restaurant</MenuItem>
          <MenuItem value={"Hotel"}>Hotel</MenuItem>
          <MenuItem value={"Travel"}>Travel</MenuItem>
        </TextField>
      </div>
    </>
  );
  const stepViews = [step1, step2];
  return (
    <>
      <Dialog fullWidth open={openAdd} onClose={handleAddClose}>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between" }}>
          <div>Add new Coupon</div>
          <div>
            {step === 0 && (
              <TextField
                select
                label="Choose Currency"
                defaultValue={currencies[curr].name}
                size="small"
                sx={{ width: "160px" }}
              >
                {currencies.map((itemCurr, index) => (
                  <MenuItem
                    key={index}
                    value={itemCurr.code}
                    onClick={() => {
                      setCurr(index);
                    }}
                  >
                    {itemCurr.name}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </div>
        </DialogTitle>
        <DialogContent
          sx={{
            gap: "1em",
            display: "flex",
            flexDirection: "column",
            paddingY: "1em",
            justifyContent: "center",
            height: "300px",
          }}
        >
          {stepViews[step]}
        </DialogContent>
        <DialogActions sx={{ padding: "1em" }}>
          <MobileStepper
            sx={{ width: "100%" }}
            position="static"
            steps={stepViews.length}
            activeStep={step}
            backButton={
              <Button
                disabled={step === 0}
                onClick={() => {
                  if (step === 0) return;
                  setStep((prev) => prev - 1);
                }}
              >
                Back
              </Button>
            }
            nextButton={
              step === stepViews.length - 1 ? (
                <>
                  <Button onClick={() => handleAddClose()}>Cancel</Button>
                  <Button variant="contained" onClick={() => handleAddSubmit()}>
                    Add
                  </Button>
                </>
              ) : (
                <Button
                  disabled={step === stepViews.length - 1}
                  onClick={() => {
                    if (step === stepViews.length - 1) return;
                    setStep((prev) => prev + 1);
                  }}
                >
                  Next
                </Button>
              )
            }
          />
        </DialogActions>
      </Dialog>
      <PageHeading text="Coupons" />
      <div>
        <div
          style={{
            borderColor: "#122159",
            marginBottom: "1px",
            display: "flex",
            justifyContent: "end",
          }}
        >
          <div>
            <Button
              variant="contained"
              onClick={() => setOpenAdd(true)}
              sx={{ backgroundColor: "#122159" }}
            >
              Add New Coupon
            </Button>
          </div>
        </div>
      </div>
      {coupons.map((coupon, index) => (
        <div
          style={{
            height: "200px",
            border: "1px solid #122159",
            padding: "1em 1em",
            marginTop: "1em",
          }}
          key={index}
        >
          <div style={{ backgroundColor: "#f7df48", display: "flex" }}>
            {coupon.code}
          </div>
        </div>
      ))}
    </>
  );
};

export default Coupons;
