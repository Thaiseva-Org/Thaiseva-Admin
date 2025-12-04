import {
  Page,
  Document,
  Image,
  StyleSheet,
  View,
  Text,
} from "@react-pdf/renderer";
import InvoiceTitle from "./InvoiceTitle";
import InvoiceNo from "./InvoiceNo";
import InvoiceItemsTable from "./InvoiceItemsTable";
import InvoiceThankYouMsg from "./InvoiceThankYouMsg";
import logo from "../../assets/logo.png";
import shape from "../../assets/shape.png";
import PaymentTo from "./PaymentTo";
import AccountInfo from "./AccountInfo";

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
    color: "yellow",
    fontSize: 18,
    marginLeft: 15,
    marginTop: 2,
    fontWeight: "extrabold",
  },
  logoContainer: {
    padding: "10px 15px 0",
  },
  logo: {
    width: 50,
    height: 50,
    marginLeft: "auto",
    marginRight: "auto",
  },
  shape: {
    width: "100%",
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0,
  },
});

const Invoice = ({ invoice, contactInfo }) => (
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
          <InvoiceTitle title="Thaiseva" />
        </View>
      </View>
      <PaymentTo paymentTo={invoice?.paymentTo} />
      <InvoiceNo
        paymentDate={invoice?.paymentDate}
        invoiceDate={invoice?.invoiceDate}
      />
      <InvoiceItemsTable paymentTable={invoice?.paymentTable} />
      <AccountInfo bankInfo={invoice?.bankInfo} />
      <InvoiceThankYouMsg contactInfo={contactInfo} />
    </Page>
  </Document>
);

export default Invoice;
