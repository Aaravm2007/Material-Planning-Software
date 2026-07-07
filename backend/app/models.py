from sqlalchemy import Column, Integer, String, Boolean
from app.database import Base


class MaterialRow(Base):
    __tablename__ = "material_rows"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(36), unique=True, nullable=True, index=True)
    workflow_status = Column(String(30), default="po_pi", nullable=True)
    order_plan_id = Column(Integer, nullable=True, index=True)

    # PO/PI stage
    srno = Column(String, nullable=True)
    date_of_po = Column(String, nullable=True)
    supplier_name = Column(String, nullable=True)
    rocket_item_code = Column(String, nullable=True)
    supplier_code = Column(String, nullable=True)
    po_number = Column(String, nullable=True)
    po_quantity = Column(String, nullable=True)
    po_rate = Column(String, nullable=True)
    po_total_value = Column(String, nullable=True)
    pi_number = Column(String, nullable=True)
    pi_date = Column(String, nullable=True)
    supplier_model_number = Column(String, nullable=True)
    pi_quantity = Column(String, nullable=True)
    pi_rate = Column(String, nullable=True)
    pi_total_value = Column(String, nullable=True)
    tentative_exworks_at_po_time = Column(String, nullable=True)
    confirmed_exworks = Column(String, nullable=True)
    credit_time = Column(String, nullable=True)
    currency = Column(String, nullable=True)
    exchange_rate = Column(String, nullable=True)

    # Import Planning stage
    etd = Column(String, nullable=True)
    port = Column(String, nullable=True)
    shipping_company = Column(String, nullable=True)
    estimated_destination_charges = Column(String, nullable=True)
    freight_charges = Column(String, nullable=True)
    bl_no = Column(String, nullable=True)
    bl_date = Column(String, nullable=True)
    insurance = Column(String, nullable=True)
    estimated_eta = Column(String, nullable=True)
    confirmed_eta = Column(String, nullable=True)
    inbond = Column(String, nullable=True)
    home_consumption = Column(String, nullable=True)
    shipment_status = Column(String, nullable=True)

    # BOE stage
    boe_no = Column(String, nullable=True)
    provisional_boe = Column(String, nullable=True)
    actual_boe = Column(String, nullable=True)
    customs_rate = Column(String, nullable=True)  # percentage applied to the actual BOE entries total

    # Bond stage (inbond rows only) — a bond row can be split into several
    # exbond rows; children reference their parent via bond_parent_uid.
    bond_parent_uid = Column(String(36), nullable=True, index=True)
    exbond_boe_no = Column(String, nullable=True)
    exbond_quantity = Column(String, nullable=True)

    # Transportation stage
    transportation_inbound = Column(String, nullable=True)
    transportation_outbound_home = Column(String, nullable=True)
    sap_inward_no = Column(String, nullable=True)
    cha_name = Column(String, nullable=True)
    cha_charges = Column(String, nullable=True)
    other_charges = Column(String, nullable=True)
    confirmed_destination_charges = Column(String, nullable=True)
    landing_cost = Column(String, nullable=True)

    # Due Date stage
    estimated_due_date = Column(String, nullable=True)
    confirmed_due_date = Column(String, nullable=True)
    hedged = Column(String, nullable=True)
    confirmed_payment_amt = Column(String, nullable=True)
    confirmed_payment_exchange = Column(String, nullable=True)
    advance_given = Column(String, nullable=True)
    fields_entered = Column(Boolean, default=False)
    modified_by = Column(String, nullable=True)
    modified_at = Column(String, nullable=True)


class ActualBoeEntry(Base):
    __tablename__ = "actual_boe_entries"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(36), nullable=False, index=True)
    amount = Column(String, nullable=False)
    currency = Column(String, nullable=True)
    rate = Column(String, nullable=True)
    note = Column(String, nullable=True)
    created_at = Column(String, nullable=True)


class ShippingOption(Base):
    __tablename__ = "shipping_options"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(36), nullable=False, index=True)
    name = Column(String, nullable=True)
    shipping_line = Column(String, nullable=True)
    freight = Column(String, nullable=True)
    etd = Column(String, nullable=True)
    eta = Column(String, nullable=True)
    rate = Column(String, nullable=True)
    port = Column(String, nullable=True)
    currency = Column(String, nullable=True)
    exchange_rate = Column(String, nullable=True)
    is_selected = Column(Boolean, nullable=True, default=False)
    created_at = Column(String, nullable=True)


class OrderPlan(Base):
    __tablename__ = "order_plans"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(36), unique=True, nullable=True, index=True)
    supplier_name = Column(String, nullable=False)
    quantity = Column(String, nullable=True)
    rate = Column(String, nullable=True)
    target_date = Column(String, nullable=True)
    remark = Column(String, nullable=True)
    created_at = Column(String, nullable=True)
    supplier_model_number = Column(String, nullable=True)
    unit = Column(String, nullable=True)  # "nos" | "containers"
    container_count = Column(String, nullable=True)     # only meaningful when unit="containers"
    nos_per_container = Column(String, nullable=True)   # only meaningful when unit="containers"
    # legacy column kept for existing rows
    requirement_date = Column(String, nullable=True)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=True)
    role = Column(String, nullable=False, default="user")
    is_blocked = Column(Boolean, default=False)
    force_reauth = Column(Boolean, default=False)


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    supplier_name = Column(String, nullable=False)
    supplier_code = Column(String, nullable=False)
    created_at = Column(String, nullable=True)


class SupplierModel(Base):
    __tablename__ = "supplier_models"

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, nullable=False, index=True)
    model_number = Column(String, nullable=False)
    created_at = Column(String, nullable=True)


class HedgingRecord(Base):
    __tablename__ = "hedging_records"

    id = Column(Integer, primary_key=True, index=True)
    hedged_date = Column(String, nullable=True)
    contract_number = Column(String, nullable=True)
    hedge_rate = Column(String, nullable=True)
    hedged_currency_amount = Column(String, nullable=True)
    currency = Column(String, nullable=True)
    amount_in_inr = Column(String, nullable=True)
    created_at = Column(String, nullable=True)


class ChaRecord(Base):
    __tablename__ = "cha_records"

    id = Column(Integer, primary_key=True, index=True)
    cha_name = Column(String, nullable=False)
    agent_name = Column(String, nullable=True)
    cha_charges = Column(String, nullable=True)
    date = Column(String, nullable=True)
    created_at = Column(String, nullable=True)


class CreditRecord(Base):
    __tablename__ = "credit_records"

    id = Column(Integer, primary_key=True, index=True)
    company = Column(String, nullable=False)
    credit_amt = Column(String, nullable=False)
    date = Column(String, nullable=True)
    created_at = Column(String, nullable=True)


class Port(Base):
    __tablename__ = "ports"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(String, nullable=True)


class ShippingLine(Base):
    __tablename__ = "shipping_lines"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(String, nullable=True)


class ShippingLineAgent(Base):
    __tablename__ = "shipping_line_agents"

    id = Column(Integer, primary_key=True, index=True)
    shipping_line_id = Column(Integer, nullable=False, index=True)
    agent_name = Column(String, nullable=False)
    created_at = Column(String, nullable=True)


class ShippingLineFreight(Base):
    __tablename__ = "shipping_line_freights"

    id = Column(Integer, primary_key=True, index=True)
    shipping_line_id = Column(Integer, nullable=False, index=True)
    date = Column(String, nullable=False)
    freight_charge = Column(String, nullable=False)
    created_at = Column(String, nullable=True)


class PiItem(Base):
    """Model-wise bifurcation of a PI: one row per supplier model number.

    Rows without any items behave as single-product rows (legacy path)."""
    __tablename__ = "pi_items"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(36), nullable=False, index=True)  # MaterialRow.uid
    model_number = Column(String, nullable=False)
    quantity = Column(String, nullable=True)
    rate = Column(String, nullable=True)
    created_at = Column(String, nullable=True)


class Branch(Base):
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(String, nullable=True)


class Allotment(Base):
    __tablename__ = "allotments"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String(36), nullable=False, index=True)  # MaterialRow.uid this allotment is against
    branch_name = Column(String, nullable=False)
    model_number = Column(String, nullable=True)  # null for legacy single-product rows
    quantity = Column(String, nullable=True)
    min_rate = Column(String, nullable=True)
    max_rate = Column(String, nullable=True)
    created_at = Column(String, nullable=True)
    created_by = Column(String, nullable=True)


class TableColumnOrder(Base):
    __tablename__ = "table_column_orders"

    id = Column(Integer, primary_key=True, index=True)
    table_name = Column(String, unique=True, nullable=False, index=True)
    column_order = Column(String, nullable=False)  # JSON-encoded list[str] of column keys
    updated_by = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)
