import {
  Page,
  Document,
  Image,
  StyleSheet,
  View,
  Text,
} from "@react-pdf/renderer";
// import InvoiceTitle from "./InvoiceTitle";
import InvoiceNo from "./InvoiceNo";
import InvoiceItemsTable from "./InvoiceItemsTable";
import InvoiceThankYouMsg from "./InvoiceThankYouMsg";
import { logo } from "../../assets";
import shape from "../../assets/shape.png";
import PaymentTo from "./PaymentTo";
// import AccountInfo from "./AccountInfo";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 11,
    lineHeight: 1.5,
    flexDirection: "column",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  left: {
    width: 160,
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    position: "relative",
  },
  headerTitle: {
    color: "#FFFF00",
    fontSize: 18,
    marginLeft: 15,
    marginTop: 2,
    fontWeight: "bold",
  },
  logoContainer: {
    paddingTop: 10,
    paddingLeft: 15,
    paddingRight: 15,
  },
  logo: {
    width: 100,
    //   height: 50,
    marginRight: "2%",
    //   transform: "translateX(-50%)",
  },
  shape: {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
  },
  accountInfo: {
    marginTop: 20,
    flexGrow: 1,
    // padding: "0 15px",
    paddingHorizontal: 15,
  },
  paymentTo: {
    marginTop: 10,
    marginBottom: 3,
    fontWeight: "bold",
    // fontFamily: "Helvetica-Oblique",
    borderBottom: "0.5px solid black",
  },
});

const PartnerInvoice = ({ invoice, contactInfo }) => (
  <Document>
    <Page size="A5" style={styles.page}>
      <View style={styles.header}>
        <View>
          <View style={styles.left}>
            <Image style={styles.shape} src={shape} />
            <Text style={styles.headerTitle}>Partner Invoice</Text>
          </View>
        </View>
        <View style={styles.logoContainer}>
          <Image style={styles.logo} src={logo} />
          {/* <InvoiceTitle title="Thaiseva" /> */}
        </View>
      </View>
      <PaymentTo paymentTo={invoice?.paymentTo} />
      <InvoiceNo
        paymentDate={invoice?.paymentDate}
        invoiceDate={invoice?.invoiceDate}
      />
      <InvoiceItemsTable paymentTable={invoice?.paymentTable} />
      {/* <AccountInfo bankInfo={invoice?.bankInfo} /> */}
      <View style={styles.accountInfo}>
        <Text style={styles.paymentTo}> Customer Info</Text>
        <Text>Name : {invoice?.partnerInfo?.name}</Text>
        <Text>Contact : {invoice?.partnerInfo?.contact}</Text>
      </View>
      <InvoiceThankYouMsg contactInfo={contactInfo} />
    </Page>
  </Document>
);

export default PartnerInvoice;
