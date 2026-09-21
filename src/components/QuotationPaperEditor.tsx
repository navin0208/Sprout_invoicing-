'use client';

import { Fragment, useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { computeLine } from '@/lib/calc';
import { toCents, formatMoney, formatDate } from '@/lib/money';
import { amountInWords } from '@/lib/words';
import { DEFAULT_LOGO_PATH } from '@/lib/brand';
import { Icon } from './Icon';
import { Modal } from './Modal';
import { useToast } from './Toast';

// -------------------------------------------------------------
// Indian States list for GST Place of Supply
// -------------------------------------------------------------
const INDIAN_STATES = [
  '01 - Jammu & Kashmir',
  '02 - Himachal Pradesh',
  '03 - Punjab',
  '04 - Chandigarh',
  '05 - Uttarakhand',
  '06 - Haryana',
  '07 - Delhi',
  '08 - Rajasthan',
  '09 - Uttar Pradesh',
  '10 - Bihar',
  '11 - Sikkim',
  '12 - Arunachal Pradesh',
  '13 - Nagaland',
  '14 - Manipur',
  '15 - Mizoram',
  '16 - Tripura',
  '17 - Meghalaya',
  '18 - Assam',
  '19 - West Bengal',
  '20 - Jharkhand',
  '21 - Odisha',
  '22 - Chhattisgarh',
  '23 - Madhya Pradesh',
  '24 - Gujarat',
  '26 - Dadra and Nagar Haveli and Daman and Diu',
  '27 - Maharashtra',
  '28 - Andhra Pradesh (Old)',
  '29 - Karnataka',
  '30 - Goa',
  '31 - Lakshadweep',
  '32 - Kerala',
  '33 - Tamil Nadu',
  '34 - Puducherry',
  '35 - Andaman and Nicobar Islands',
  '36 - Telangana',
  '37 - Andhra Pradesh (New)',
  '38 - Ladakh',
  '97 - Other Territory'
];

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  gstin: string | null;
};

type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  unit: string;
  rateCents: number;
  taxPercent: number | null;
};

export type CustomColumnType = 'TEXT' | 'NUMBER' | 'CURRENCY' | 'FORMULA';

export type CustomColumn = {
  id: string;
  name: string;
  type: CustomColumnType;
  formulaPreset?: string;
  formulaExpression?: string;
  align?: 'left' | 'center' | 'right';
  widthClass?: string;
};

export type LineItem = {
  id: string;
  groupId?: string | null;
  itemId: string | null;
  name: string;
  description: string;
  showDescription: boolean;
  imageUrl: string | null;
  hsn: string;
  quantity: number;
  unit: string;
  rate: number;
  taxPercent: number;
  customValues?: Record<string, string | number>;
};

export type ItemGroup = {
  id: string;
  title: string;
};

export type CustomField = {
  id: string;
  label: string;
  value: string;
};

export type AdditionalCharge = {
  id: string;
  label: string;
  amount: number;
};

export type ColumnConfig = {
  hsn: boolean;
  image: boolean;
  unit: boolean;
  rate: boolean;
  tax: boolean;
  cgstSgst: boolean;
  hsnLabel: string;
  rateLabel: string;
  taxLabel: string;
};

export type NumberFormatConfig = {
  numberingSystem: 'INDIAN' | 'INTERNATIONAL';
  decimalPrecision: 0 | 2 | 3;
  roundingRule: 'NORMAL' | 'UP' | 'DOWN' | 'NONE';
};

export type GstConfig = {
  placeOfSupply: string;
  taxMode: 'INTRASTATE' | 'INTERSTATE'; // Intrastate: CGST+SGST, Interstate: IGST
  rcm: boolean;
};

export type AdvancedDisplayOptions = {
  hideHsn: boolean;
  hideImages: boolean;
  hideTaxBreakdown: boolean;
  hideBankDetails: boolean;
  hideUpiQr: boolean;
  hideTotalInWords: boolean;
  hideGroupSubtotals: boolean;
};

export type QuotationEditorInitial = {
  number?: string;
  clientId: string;
  currency: string;
  issueDate: string;
  dueDate: string; // expiryDate for quotations
  discountType: 'NONE' | 'PERCENT' | 'FLAT';
  discountValue: number;
  notes: string;
  terms: string;
  items: any[];
};

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function genId() {
  return 'id_' + Math.random().toString(36).slice(2, 9);
}

export function QuotationPaperEditor({
  documentId,
  initial,
  defaultClientId
}: {
  documentId?: string;
  initial?: QuotationEditorInitial;
  defaultClientId?: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [settings, setSettings] = useState<{
    businessName: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    gstin: string | null;
    logoDataUrl: string | null;
    defaultCurrency: string;
    defaultTaxPercent: number;
    defaultTermsQuote: string | null;
    quotePrefix: string;
    nextQuoteNumber: number;
    bankDetails: string | null;
    upiId: string | null;
  } | null>(null);

  const [saving, setSaving] = useState(false);

  // 1. Document Header & Branding State
  const [quoteNumber, setQuoteNumber] = useState(initial?.number || '');
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? todayISO());
  const [expiryDate, setExpiryDate] = useState(initial?.dueDate ?? todayISO(15));
  const [logoUrl, setLogoUrl] = useState<string | null>(DEFAULT_LOGO_PATH);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // 2. Entity Details State
  const [clientId, setClientId] = useState(initial?.clientId ?? defaultClientId ?? '');
  const [showShipping, setShowShipping] = useState(false);
  const [shippingSameAsBilling, setShippingSameAsBilling] = useState(true);
  const [shippingAddress, setShippingAddress] = useState('');

  // 3. Configuration Toolbar State
  const [currency, setCurrency] = useState(initial?.currency ?? 'INR');
  const [gstConfig, setGstConfig] = useState<GstConfig>({
    placeOfSupply: '27 - Maharashtra',
    taxMode: 'INTRASTATE',
    rcm: false
  });
  const [numberFormat, setNumberFormat] = useState<NumberFormatConfig>({
    numberingSystem: 'INDIAN',
    decimalPrecision: 2,
    roundingRule: 'NORMAL'
  });
  const [columnConfig, setColumnConfig] = useState<ColumnConfig>({
    hsn: true,
    image: true,
    unit: true,
    rate: true,
    tax: true,
    cgstSgst: true,
    hsnLabel: 'HSN/SAC',
    rateLabel: 'Rate',
    taxLabel: 'GST Rate'
  });

  // Dynamic Custom Columns State
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<CustomColumnType>('TEXT');
  const [newColPreset, setNewColPreset] = useState('CUSTOM');
  const [newColFormula, setNewColFormula] = useState('');
  const [newColAlign, setNewColAlign] = useState<'left' | 'center' | 'right'>('left');

  // Modals state
  const [showGstModal, setShowGstModal] = useState(false);
  const [showNumberFormatModal, setShowNumberFormatModal] = useState(false);
  const [showColumnsModal, setShowColumnsModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showEditBusinessModal, setShowEditBusinessModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  // 4. Line Items & Groups State
  const [groups, setGroups] = useState<ItemGroup[]>([]);
  const [lines, setLines] = useState<LineItem[]>(() => {
    if (initial?.items?.length) {
      return initial.items.map((it) => ({
        id: genId(),
        itemId: it.itemId || null,
        name: it.description?.split('\n')[0] || '',
        description: it.description?.split('\n').slice(1).join('\n') || '',
        showDescription: Boolean(it.description?.includes('\n')),
        imageUrl: null,
        hsn: '',
        quantity: Number(it.quantity) || 1,
        unit: it.unit || 'unit',
        rate: Number(it.rate) || 0,
        taxPercent: Number(it.taxPercent) || 0,
        customValues: {}
      }));
    }
    return [
      {
        id: genId(),
        itemId: null,
        name: '',
        description: '',
        showDescription: false,
        imageUrl: null,
        hsn: '',
        quantity: 1,
        unit: 'unit',
        rate: 0,
        taxPercent: 18,
        customValues: {}
      }
    ];
  });

  // 5. Payment Details & Financial Summary State
  const [bankDetails, setBankDetails] = useState({
    enabled: true,
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    accountHolder: '',
    branch: ''
  });
  const [upiDetails, setUpiDetails] = useState({
    enabled: true,
    upiId: '',
    payeeName: ''
  });
  const [discountType, setDiscountType] = useState<'NONE' | 'PERCENT' | 'FLAT'>(initial?.discountType ?? 'NONE');
  const [discountValue, setDiscountValue] = useState(initial?.discountValue ?? 0);
  const [showDiscountsBlock, setShowDiscountsBlock] = useState(initial?.discountType !== 'NONE');
  const [additionalCharges, setAdditionalCharges] = useState<AdditionalCharge[]>([]);
  const [showAdditionalChargesBlock, setShowAdditionalChargesBlock] = useState(false);
  const [signatureData, setSignatureData] = useState<{
    imageUrl: string | null;
    signatoryName: string;
    designation: string;
  }>({
    imageUrl: null,
    signatoryName: '',
    designation: 'Authorized Signatory'
  });

  // 6. Document Modifiers & Advanced Options State
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [showNotes, setShowNotes] = useState(Boolean(initial?.notes));
  const [terms, setTerms] = useState(initial?.terms ?? '');
  const [showTerms, setShowTerms] = useState(Boolean(initial?.terms));
  const [attachments, setAttachments] = useState<{ id: string; name: string; url: string }[]>([]);
  const [showAttachments, setShowAttachments] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState<{ id: string; key: string; value: string }[]>([]);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  const [contactPerson, setContactPerson] = useState({ name: '', phone: '', email: '' });
  const [showContactPerson, setShowContactPerson] = useState(false);

  const [advancedOptions, setAdvancedOptions] = useState<AdvancedDisplayOptions>({
    hideHsn: false,
    hideImages: false,
    hideTaxBreakdown: false,
    hideBankDetails: false,
    hideUpiQr: false,
    hideTotalInWords: false,
    hideGroupSubtotals: false
  });

  const [standardTerms, setStandardTerms] = useState('');
  const [attachmentInput, setAttachmentInput] = useState('');
  const [savingBusinessProfile, setSavingBusinessProfile] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // Load clients, items, and settings
  useEffect(() => {
    apiFetch<Client[]>('/api/clients').then(setClients);
    apiFetch<CatalogItem[]>('/api/items').then(setCatalog);
    apiFetch<any>('/api/settings').then((s) => {
      setSettings(s);
      setStandardTerms(s.defaultTermsQuote || '');
      setLogoUrl(s.logoDataUrl || DEFAULT_LOGO_PATH);

      if (s.upiId) {
        setUpiDetails((prev) => ({
          ...prev,
          upiId: s.upiId,
          payeeName: s.businessName
        }));
      }

      if (s.bankDetails) {
        setBankDetails((prev) => ({
          ...prev,
          bankName: s.bankDetails
        }));
      }

      if (!initial) {
        setCurrency(s.defaultCurrency || 'INR');
        if (s.defaultTermsQuote) {
          setTerms(s.defaultTermsQuote);
          setShowTerms(true);
        }
        if (!quoteNumber) {
          const prefix = s.quotePrefix || 'QUO-';
          const nextNo = s.nextQuoteNumber || 1;
          setQuoteNumber(`${prefix}${String(nextNo).padStart(4, '0')}`);
        }
        setLines((prev) =>
          prev.map((l) => (l.taxPercent === 0 ? { ...l, taxPercent: s.defaultTaxPercent || 18 } : l))
        );
      }
    });
  }, [initial, quoteNumber]);

  // Selected client object
  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === clientId) || null;
  }, [clients, clientId]);

  // Handle logo drop & selection
  function handleLogoFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, SVG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setLogoUrl(dataUrl);
      toast.success('Business logo updated.');
    };
    reader.readAsDataURL(file);
  }

  function handleResetLogo() {
    setLogoUrl(DEFAULT_LOGO_PATH);
    toast.success('Reset to default The Sprout Media logo.');
  }

  // -------------------------------------------------------------
  // Financial Calculations & Totals
  // -------------------------------------------------------------
  const totals = useMemo(() => {
    // 1. Raw Line Subtotals
    const computedLines = lines.map((l) => {
      const subtotal = (Number(l.quantity) || 0) * (Number(l.rate) || 0);
      return {
        ...l,
        lineSubtotal: subtotal
      };
    });

    const subtotal = computedLines.reduce((acc, l) => acc + l.lineSubtotal, 0);

    // 2. Discount Calculation
    let discount = 0;
    if (discountType === 'PERCENT') {
      discount = (subtotal * (Number(discountValue) || 0)) / 100;
    } else if (discountType === 'FLAT') {
      discount = Number(discountValue) || 0;
    }
    discount = Math.min(discount, subtotal);

    const discountRatio = subtotal > 0 ? discount / subtotal : 0;

    // 3. Tax Calculation (Interstate IGST vs Intrastate CGST+SGST)
    let totalTax = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;

    computedLines.forEach((l) => {
      const discountedBase = l.lineSubtotal * (1 - discountRatio);
      const taxRate = Number(l.taxPercent) || 0;
      const lineTax = (discountedBase * taxRate) / 100;
      totalTax += lineTax;

      if (gstConfig.taxMode === 'INTRASTATE') {
        cgstTotal += lineTax / 2;
        sgstTotal += lineTax / 2;
      } else {
        igstTotal += lineTax;
      }
    });

    // 4. Additional Charges
    const totalAdditionalCharges = additionalCharges.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);

    // 5. Total before rounding
    const unroundedTotal = subtotal - discount + totalTax + totalAdditionalCharges;

    // 6. Rounding
    let finalTotal = unroundedTotal;
    let roundOff = 0;

    if (numberFormat.roundingRule === 'NORMAL') {
      finalTotal = Math.round(unroundedTotal);
      roundOff = finalTotal - unroundedTotal;
    } else if (numberFormat.roundingRule === 'UP') {
      finalTotal = Math.ceil(unroundedTotal);
      roundOff = finalTotal - unroundedTotal;
    } else if (numberFormat.roundingRule === 'DOWN') {
      finalTotal = Math.floor(unroundedTotal);
      roundOff = finalTotal - unroundedTotal;
    }

    return {
      subtotal,
      discount,
      totalTax,
      cgstTotal,
      sgstTotal,
      igstTotal,
      totalAdditionalCharges,
      roundOff,
      finalTotal,
      totalCents: Math.round(finalTotal * 100)
    };
  }, [lines, discountType, discountValue, gstConfig.taxMode, additionalCharges, numberFormat.roundingRule]);

  // Currency formatted display helper respecting user's numbering system and decimals
  function formatCurr(val: number) {
    const locale = numberFormat.numberingSystem === 'INDIAN' ? 'en-IN' : 'en-US';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: numberFormat.decimalPrecision,
        maximumFractionDigits: numberFormat.decimalPrecision
      }).format(val);
    } catch {
      return `${currency} ${val.toFixed(numberFormat.decimalPrecision)}`;
    }
  }

  // -------------------------------------------------------------
  // Line & Group Management
  // -------------------------------------------------------------
  function addLine(groupId?: string | null) {
    const targetGroupId =
      groupId !== undefined ? groupId : groups.length > 0 ? groups[groups.length - 1].id : null;
    setLines((prev) => [
      ...prev,
      {
        id: genId(),
        groupId: targetGroupId,
        itemId: null,
        name: '',
        description: '',
        showDescription: false,
        imageUrl: null,
        hsn: '',
        quantity: 1,
        unit: 'unit',
        rate: 0,
        taxPercent: settings?.defaultTaxPercent || 18,
        customValues: {}
      }
    ]);
  }

  function addGroup() {
    const newGroup: ItemGroup = {
      id: genId(),
      title: `Group ${groups.length + 1}: Deliverables`
    };
    setGroups((prev) => [...prev, newGroup]);
    addLine(newGroup.id);
    toast.success(`Created "${newGroup.title}"`);
  }

  function updateGroupTitle(groupId: string, title: string) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, title } : g)));
  }

  function removeGroup(groupId: string) {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    setLines((prev) => prev.filter((l) => l.groupId !== groupId));
    toast.success('Group section removed.');
  }

  function updateLine(id: string, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function addBulletToLineDescription(lineId: string, currentVal: string) {
    let nextVal = currentVal ? currentVal.trimEnd() : '';
    if (!nextVal) {
      nextVal = '• ';
    } else {
      nextVal = nextVal + '\n• ';
    }
    updateLine(lineId, { description: nextVal, showDescription: true });
  }

  function addNumberToLineDescription(lineId: string, currentVal: string) {
    let nextVal = currentVal ? currentVal.trimEnd() : '';
    if (!nextVal) {
      nextVal = '1. ';
    } else {
      const linesArr = nextVal.split('\n');
      const lastLine = linesArr[linesArr.length - 1];
      const match = lastLine.match(/^(\d+)[\.\)]/);
      const nextNum = match ? parseInt(match[1], 10) + 1 : linesArr.length + 1;
      nextVal = nextVal + `\n${nextNum}. `;
    }
    updateLine(lineId, { description: nextVal, showDescription: true });
  }

  function formatLineDescriptionAsBullets(lineId: string, currentVal: string) {
    if (!currentVal.trim()) {
      updateLine(lineId, { description: '• ', showDescription: true });
      return;
    }
    const linesArr = currentVal.split('\n');
    const converted = linesArr
      .map((l) => {
        const trimmed = l.trim();
        if (!trimmed) return '';
        if (/^[•\-\*]\s*/.test(trimmed)) return trimmed;
        const cleaned = trimmed.replace(/^\d+[\.\)]\s*/, '');
        return `• ${cleaned}`;
      })
      .join('\n');
    updateLine(lineId, { description: converted, showDescription: true });
    toast.success('Description formatted with bullets.');
  }

  function handleDescriptionKeyDown(
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    lineId: string,
    currentVal: string
  ) {
    if (e.key === 'Enter') {
      const textarea = e.currentTarget;
      const selStart = textarea.selectionStart;
      const selEnd = textarea.selectionEnd;
      const textBefore = currentVal.slice(0, selStart);
      const textAfter = currentVal.slice(selEnd);

      const lastLineBreak = textBefore.lastIndexOf('\n');
      const currentLine = lastLineBreak === -1 ? textBefore : textBefore.slice(lastLineBreak + 1);

      const bulletMatch = currentLine.match(/^(\s*)([•\-\*])\s*(.*)$/);
      const numberMatch = currentLine.match(/^(\s*)(\d+)[\.\)]\s*(.*)$/);

      if (bulletMatch) {
        e.preventDefault();
        const [_, indent, bullet, content] = bulletMatch;
        if (!content.trim()) {
          const newTextBefore = lastLineBreak === -1 ? '' : textBefore.slice(0, lastLineBreak + 1);
          const nextVal = newTextBefore + textAfter;
          updateLine(lineId, { description: nextVal });
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newTextBefore.length;
          }, 0);
        } else {
          const insertion = `\n${indent}${bullet} `;
          const nextVal = textBefore + insertion + textAfter;
          updateLine(lineId, { description: nextVal });
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selStart + insertion.length;
          }, 0);
        }
      } else if (numberMatch) {
        e.preventDefault();
        const [_, indent, numStr, content] = numberMatch;
        if (!content.trim()) {
          const newTextBefore = lastLineBreak === -1 ? '' : textBefore.slice(0, lastLineBreak + 1);
          const nextVal = newTextBefore + textAfter;
          updateLine(lineId, { description: nextVal });
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newTextBefore.length;
          }, 0);
        } else {
          const nextNum = parseInt(numStr, 10) + 1;
          const insertion = `\n${indent}${nextNum}. `;
          const nextVal = textBefore + insertion + textAfter;
          updateLine(lineId, { description: nextVal });
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selStart + insertion.length;
          }, 0);
        }
      }
    }
  }

  function handleAddBulletToTerms() {
    let nextVal = terms ? terms.trimEnd() : '';
    if (!nextVal) {
      nextVal = '• ';
    } else {
      nextVal = nextVal + '\n• ';
    }
    setTerms(nextVal);
  }

  function handleAddNumberToTerms() {
    let nextVal = terms ? terms.trimEnd() : '';
    if (!nextVal) {
      nextVal = '1. ';
    } else {
      const linesArr = nextVal.split('\n');
      const lastLine = linesArr[linesArr.length - 1];
      const match = lastLine.match(/^(\d+)[\.\)]/);
      const nextNum = match ? parseInt(match[1], 10) + 1 : linesArr.length + 1;
      nextVal = nextVal + `\n${nextNum}. `;
    }
    setTerms(nextVal);
  }

  function handleConvertTermsToBullets() {
    if (!terms.trim()) {
      setTerms('• ');
      return;
    }
    const linesArr = terms.split('\n');
    const converted = linesArr
      .map((l) => {
        const trimmed = l.trim();
        if (!trimmed) return '';
        if (/^[•\-\*]\s*/.test(trimmed)) return trimmed;
        const cleaned = trimmed.replace(/^\d+[\.\)]\s*/, '');
        return `• ${cleaned}`;
      })
      .join('\n');
    setTerms(converted);
    toast.success('Terms formatted as bullet points.');
  }

  function handleTermsKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter') {
      const textarea = e.currentTarget;
      const selStart = textarea.selectionStart;
      const selEnd = textarea.selectionEnd;
      const textBefore = terms.slice(0, selStart);
      const textAfter = terms.slice(selEnd);

      const lastLineBreak = textBefore.lastIndexOf('\n');
      const currentLine = lastLineBreak === -1 ? textBefore : textBefore.slice(lastLineBreak + 1);

      const bulletMatch = currentLine.match(/^(\s*)([•\-\*])\s*(.*)$/);
      const numberMatch = currentLine.match(/^(\s*)(\d+)[\.\)]\s*(.*)$/);

      if (bulletMatch) {
        e.preventDefault();
        const [_, indent, bullet, content] = bulletMatch;
        if (!content.trim()) {
          const newTextBefore = lastLineBreak === -1 ? '' : textBefore.slice(0, lastLineBreak + 1);
          const nextVal = newTextBefore + textAfter;
          setTerms(nextVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newTextBefore.length;
          }, 0);
        } else {
          const insertion = `\n${indent}${bullet} `;
          const nextVal = textBefore + insertion + textAfter;
          setTerms(nextVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selStart + insertion.length;
          }, 0);
        }
      } else if (numberMatch) {
        e.preventDefault();
        const [_, indent, numStr, content] = numberMatch;
        if (!content.trim()) {
          const newTextBefore = lastLineBreak === -1 ? '' : textBefore.slice(0, lastLineBreak + 1);
          const nextVal = newTextBefore + textAfter;
          setTerms(nextVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = newTextBefore.length;
          }, 0);
        } else {
          const nextNum = parseInt(numStr, 10) + 1;
          const insertion = `\n${indent}${nextNum}. `;
          const nextVal = textBefore + insertion + textAfter;
          setTerms(nextVal);
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd = selStart + insertion.length;
          }, 0);
        }
      }
    }
  }

  function removeLine(id: string) {
    if (lines.length <= 1) {
      toast.info('At least one item is required in the document.');
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
    toast.success('Line item removed.');
  }

  function calcTotalCols() {
    return (
      1 + // Item / Service
      (columnConfig.hsn ? 1 : 0) +
      1 + // Qty
      (columnConfig.unit ? 1 : 0) +
      (columnConfig.rate ? 1 : 0) +
      customColumns.length +
      1 + // Amount
      (columnConfig.tax ? 1 : 0) +
      (columnConfig.cgstSgst ? (gstConfig.taxMode === 'INTRASTATE' ? 2 : 1) : 0) +
      1 + // Total
      1 // Action
    );
  }

  function insertCatalogItem(itemId: string, lineId?: string) {
    const cat = catalog.find((c) => c.id === itemId);
    if (!cat) return;

    if (lineId) {
      updateLine(lineId, {
        itemId: cat.id,
        name: cat.name,
        description: cat.description || '',
        showDescription: Boolean(cat.description),
        rate: (cat.rateCents || 0) / 100,
        unit: cat.unit || 'unit',
        taxPercent: cat.taxPercent ?? settings?.defaultTaxPercent ?? 18
      });
    } else {
      setLines((prev) => [
        ...prev,
        {
          id: genId(),
          itemId: cat.id,
          name: cat.name,
          description: cat.description || '',
          showDescription: Boolean(cat.description),
          imageUrl: null,
          hsn: '',
          quantity: 1,
          unit: cat.unit || 'unit',
          rate: (cat.rateCents || 0) / 100,
          taxPercent: cat.taxPercent ?? settings?.defaultTaxPercent ?? 18,
          customValues: {}
        }
      ]);
    }
  }

  // -------------------------------------------------------------
  // Custom Columns & Dynamic Formulas Engine Helpers
  // -------------------------------------------------------------
  function evaluateFormula(expr: string, line: LineItem): number {
    if (!expr || !expr.trim()) return 0;
    try {
      const qty = Number(line.quantity) || 0;
      const rate = Number(line.rate) || 0;
      const amount = qty * rate;
      const tax = Number(line.taxPercent) || 0;
      const taxVal = (amount * tax) / 100;

      let sanitized = expr;
      sanitized = sanitized.replace(/\[qty\]|\[quantity\]|\bqty\b|\bquantity\b/gi, String(qty));
      sanitized = sanitized.replace(/\[rate\]|\brate\b/gi, String(rate));
      sanitized = sanitized.replace(/\[amount\]|\[subtotal\]|\bamount\b|\bsubtotal\b/gi, String(amount));
      sanitized = sanitized.replace(/\[tax%\]|\[tax\]|\[gst\]|\btax\b|\bgst\b/gi, String(tax));
      sanitized = sanitized.replace(/\[taxamount\]|\[taxval\]|\btaxval\b/gi, String(taxVal));

      if (line.customValues) {
        for (const [k, v] of Object.entries(line.customValues)) {
          const numericVal = Number(v) || 0;
          sanitized = sanitized.split(`[${k}]`).join(String(numericVal));
        }
      }

      if (!/^[0-9+\-*/().% ]+$/.test(sanitized)) {
        return 0;
      }
      // eslint-disable-next-line no-new-func
      const result = new Function(`return (${sanitized})`)();
      return typeof result === 'number' && !isNaN(result) && isFinite(result) ? result : 0;
    } catch {
      return 0;
    }
  }

  function updateLineCustomValue(lineId: string, colId: string, val: string | number) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== lineId) return l;
        return {
          ...l,
          customValues: {
            ...(l.customValues || {}),
            [colId]: val
          }
        };
      })
    );
  }

  function handleAddCustomColumn() {
    if (!newColName.trim()) {
      toast.error('Please enter a column title/name.');
      return;
    }
    const resolvedFormula =
      newColType === 'FORMULA'
        ? (newColPreset !== 'CUSTOM' ? newColPreset : newColFormula.trim())
        : undefined;

    if (newColType === 'FORMULA' && !resolvedFormula) {
      toast.error('Please select or enter a formula expression for the calculated column.');
      return;
    }

    const created: CustomColumn = {
      id: 'col_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      name: newColName.trim(),
      type: newColType,
      formulaPreset: newColPreset,
      formulaExpression: resolvedFormula,
      align: newColAlign || (newColType === 'TEXT' ? 'left' : 'right')
    };

    setCustomColumns((prev) => [...prev, created]);
    setNewColName('');
    setNewColFormula('');
    setNewColPreset('CUSTOM');
    setNewColType('TEXT');
    toast.success(`Column "${created.name}" added to quotation table!`);
  }

  function handleDeleteCustomColumn(colId: string, colName: string) {
    setCustomColumns((prev) => prev.filter((c) => c.id !== colId));
    setLines((prev) =>
      prev.map((l) => {
        if (!l.customValues || !(colId in l.customValues)) return l;
        const copy = { ...l.customValues };
        delete copy[colId];
        return { ...l, customValues: copy };
      })
    );
    toast.success(`Column "${colName}" removed from table.`);
  }

  function handleUpdateCustomColumn(colId: string, patch: Partial<CustomColumn>) {
    setCustomColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, ...patch } : c)));
  }

  function handleDeleteStandardColumn(key: 'hsn' | 'unit' | 'rate' | 'tax' | 'cgstSgst', label: string) {
    setColumnConfig((prev) => ({ ...prev, [key]: false }));
    toast.success(`Column "${label}" hidden from table.`);
  }

  function handleRestoreStandardColumn(key: 'hsn' | 'unit' | 'rate' | 'tax' | 'cgstSgst', label: string) {
    setColumnConfig((prev) => ({ ...prev, [key]: true }));
    toast.success(`Column "${label}" restored to table.`);
  }

  function handleAddAttachment() {
    const val = attachmentInput.trim();
    if (!val) {
      toast.error('Please enter a link, document title or URL.');
      return;
    }
    setAttachments((prev) => [...prev, { id: genId(), name: val, url: val }]);
    setAttachmentInput('');
    toast.success(`Attachment "${val}" added.`);
  }

  async function handleSaveIssuerProfile() {
    if (!settings) return;
    setSavingBusinessProfile(true);
    try {
      const payload = {
        businessName: settings.businessName || 'The Sprout Media',
        email: settings.email || null,
        phone: settings.phone || null,
        address: settings.address || null,
        logoDataUrl: logoUrl,
        gstin: settings.gstin || null,
        defaultCurrency: currency || settings.defaultCurrency || 'INR',
        defaultTaxName: 'GST',
        defaultTaxPercent: settings.defaultTaxPercent ?? 18,
        invoicePrefix: settings.quotePrefix ? settings.quotePrefix.replace('QUO-', 'INV-') : 'INV-',
        nextInvoiceNumber: 1,
        quotePrefix: settings.quotePrefix || 'QUO-',
        nextQuoteNumber: settings.nextQuoteNumber || 1,
        defaultTermsInvoice: null,
        defaultTermsQuote: terms || settings.defaultTermsQuote || null,
        upiId: upiDetails.upiId || settings.upiId || null,
        bankDetails: bankDetails.bankName || settings.bankDetails || null,
        reminderBeforeDays: [3, 1],
        reminderOnDueDate: true,
        reminderAfterDays: [3, 7],
        reminderMaxAfterCount: 4
      };

      const updated = await apiFetch<any>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      setSettings(updated);
      toast.success('Business issuer profile saved to settings.');
      setShowEditBusinessModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save business profile.');
    } finally {
      setSavingBusinessProfile(false);
    }
  }

  function renderLineRow(line: LineItem, idx: number) {
    const sub = (Number(line.quantity) || 0) * (Number(line.rate) || 0);
    const taxVal = (sub * (Number(line.taxPercent) || 0)) / 100;
    const total = sub + taxVal;

    return (
      <tr key={line.id} className="hover:bg-purple-50/20 transition-colors">
        {/* Item Name + Secondary Action Buttons (+ Add Description, + Add Image) */}
        <td className="py-3 px-3 align-top space-y-1.5">
          <input
            type="text"
            className="input py-1 text-xs font-semibold text-brand-900"
            placeholder="Item name / Title"
            value={line.name}
            onChange={(e) => updateLine(line.id, { name: e.target.value })}
            required
          />

          {/* Secondary Action Buttons beneath Item Name */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
            <button
              type="button"
              onClick={() => updateLine(line.id, { showDescription: !line.showDescription })}
              className="text-purple-700 hover:text-purple-900 font-medium inline-flex items-center gap-1"
            >
              <Icon name={line.showDescription ? 'x' : 'plus'} className="w-3 h-3" />
              {line.showDescription ? 'Hide Description' : '+ Add Description'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!line.showDescription) {
                  updateLine(line.id, {
                    showDescription: true,
                    description: line.description ? line.description : '• '
                  });
                } else {
                  addBulletToLineDescription(line.id, line.description);
                }
              }}
              className="text-purple-700 hover:text-purple-900 font-semibold inline-flex items-center gap-1 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded border border-purple-200 transition-colors"
              title="Add bullet points to item specifications"
            >
              <span className="font-bold text-sm leading-none">•</span>
              + Add Bullet Points
            </button>

            <label className="text-purple-700 hover:text-purple-900 font-medium inline-flex items-center gap-1 cursor-pointer">
              <Icon name="plus" className="w-3 h-3" />
              {line.imageUrl ? 'Change Image' : '+ Add Image'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      updateLine(line.id, { imageUrl: ev.target?.result as string });
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </label>

            {/* Catalog quick pick dropdown */}
            {catalog.length > 0 && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) insertCatalogItem(e.target.value, line.id);
                }}
                className="text-[11px] text-purple-700 bg-transparent border-0 hover:text-purple-900 cursor-pointer font-medium p-0 focus:ring-0"
                title="Replace with an item from catalog"
              >
                <option value="" disabled>+ Pick from Catalog</option>
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({formatCurr((c.rateCents || 0) / 100)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Expanded Description Box */}
          {line.showDescription && (
            <div className="mt-2 rounded-lg border border-purple-200 bg-purple-50/20 p-2 space-y-1.5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                <span className="font-semibold text-gray-700 flex items-center gap-1">
                  <Icon name="fileSpreadsheet" className="w-3 h-3 text-purple-600" />
                  Item Specifications / Deliverables
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => addBulletToLineDescription(line.id, line.description)}
                    className="px-2 py-0.5 rounded bg-white hover:bg-purple-100 text-purple-800 border border-purple-300 font-semibold text-[11px] inline-flex items-center gap-1 shadow-2xs transition-colors"
                    title="Insert bullet point"
                  >
                    <span className="font-bold text-sm leading-none">•</span>
                    Add Bullet
                  </button>
                  <button
                    type="button"
                    onClick={() => addNumberToLineDescription(line.id, line.description)}
                    className="px-2 py-0.5 rounded bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-medium text-[11px] inline-flex items-center gap-1 shadow-2xs transition-colors"
                    title="Insert numbered item"
                  >
                    <span className="font-bold text-xs leading-none">1.</span>
                    Numbered
                  </button>
                  {line.description.trim() && (
                    <button
                      type="button"
                      onClick={() => formatLineDescriptionAsBullets(line.id, line.description)}
                      className="px-2 py-0.5 rounded bg-white hover:bg-gray-100 text-gray-600 border border-gray-300 text-[10px] hover:text-purple-700 shadow-2xs transition-colors"
                      title="Convert all lines to bullets"
                    >
                      Format Bullets
                    </button>
                  )}
                </div>
              </div>

              <textarea
                rows={4}
                className="input p-2.5 text-xs sm:text-sm w-full min-h-[105px] resize-y text-gray-800 leading-relaxed bg-white border border-gray-300 rounded-md focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-inner"
                placeholder="• Detailed scope of work, deliverable, or specification&#10;• Second deliverable or milestone (Press Enter to automatically add next bullet)"
                value={line.description}
                onKeyDown={(e) => handleDescriptionKeyDown(e, line.id, line.description)}
                onChange={(e) => updateLine(line.id, { description: e.target.value })}
              />
              <p className="text-[10px] text-gray-400 italic">
                Tip: Press <kbd className="px-1 py-0.5 bg-gray-100 border rounded text-[9px] font-mono">Enter</kbd> to automatically continue bullet points.
              </p>
            </div>
          )}

          {/* Attached Thumbnail Preview */}
          {line.imageUrl && (
            <div className="relative inline-block mt-1.5 group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={line.imageUrl}
                alt="Item preview"
                className="w-12 h-12 object-cover rounded-md border border-gray-200"
              />
              <button
                type="button"
                onClick={() => updateLine(line.id, { imageUrl: null })}
                className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 shadow-sm"
                title="Remove image"
              >
                <Icon name="x" className="w-2.5 h-2.5" />
              </button>
            </div>
          )}
        </td>

        {/* HSN/SAC */}
        {columnConfig.hsn && (
          <td className="py-3 px-2 align-top">
            <input
              type="text"
              className="input py-1 text-xs text-center font-mono"
              placeholder="998314"
              value={line.hsn}
              onChange={(e) => updateLine(line.id, { hsn: e.target.value })}
            />
          </td>
        )}

        {/* Quantity */}
        <td className="py-3 px-2 align-top">
          <input
            type="number"
            min="0.01"
            step="any"
            className="input py-1 text-xs text-right font-medium"
            value={line.quantity}
            onChange={(e) => updateLine(line.id, { quantity: Number(e.target.value) })}
          />
        </td>

        {/* Unit */}
        {columnConfig.unit && (
          <td className="py-3 px-2 align-top">
            <input
              type="text"
              className="input py-1 text-xs text-center"
              value={line.unit}
              onChange={(e) => updateLine(line.id, { unit: e.target.value })}
            />
          </td>
        )}

        {/* Rate */}
        {columnConfig.rate && (
          <td className="py-3 px-2 align-top">
            <input
              type="number"
              step="0.01"
              className="input py-1 text-xs text-right font-medium"
              value={line.rate}
              onChange={(e) => updateLine(line.id, { rate: Number(e.target.value) })}
            />
          </td>
        )}

        {/* Custom Columns Cells */}
        {customColumns.map((col) => {
          if (col.type === 'FORMULA') {
            const calcVal = evaluateFormula(col.formulaExpression || '', line);
            const isCurr =
              col.formulaPreset?.toLowerCase().includes('amount') ||
              col.name.toLowerCase().includes('rate') ||
              col.name.toLowerCase().includes('amount') ||
              col.name.toLowerCase().includes('price');
            return (
              <td
                key={col.id}
                className="py-3 px-2 align-top text-right font-semibold text-purple-900 tnum pt-4"
              >
                {isCurr ? formatCurr(calcVal) : calcVal.toFixed(2)}
              </td>
            );
          }
          if (col.type === 'CURRENCY') {
            return (
              <td key={col.id} className="py-3 px-2 align-top">
                <input
                  type="number"
                  step="0.01"
                  className="input py-1 text-xs text-right font-medium"
                  placeholder="0.00"
                  value={line.customValues?.[col.id] ?? ''}
                  onChange={(e) => updateLineCustomValue(line.id, col.id, e.target.value)}
                />
              </td>
            );
          }
          if (col.type === 'NUMBER') {
            return (
              <td key={col.id} className="py-3 px-2 align-top">
                <input
                  type="number"
                  step="any"
                  className="input py-1 text-xs text-right font-medium"
                  placeholder="0"
                  value={line.customValues?.[col.id] ?? ''}
                  onChange={(e) => updateLineCustomValue(line.id, col.id, e.target.value)}
                />
              </td>
            );
          }
          return (
            <td key={col.id} className="py-3 px-2 align-top">
              <input
                type="text"
                className="input py-1 text-xs"
                placeholder={col.name}
                value={line.customValues?.[col.id] ?? ''}
                onChange={(e) => updateLineCustomValue(line.id, col.id, e.target.value)}
              />
            </td>
          );
        })}

        {/* Amount (Qty * Rate) */}
        <td className="py-3 px-2 align-top text-right font-semibold text-gray-800 tnum pt-4">
          {formatCurr(sub)}
        </td>

        {/* Tax Rate % */}
        {columnConfig.tax && (
          <td className="py-3 px-2 align-top">
            <select
              className="input py-1 text-xs text-center"
              value={line.taxPercent}
              onChange={(e) => updateLine(line.id, { taxPercent: Number(e.target.value) })}
            >
              <option value="0">0%</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18">18%</option>
              <option value="28">28%</option>
            </select>
          </td>
        )}

        {/* CGST / SGST or IGST */}
        {columnConfig.cgstSgst && (
          <>
            {gstConfig.taxMode === 'INTRASTATE' ? (
              <>
                <td className="py-3 px-2 align-top text-right text-gray-600 tnum pt-4">
                  {formatCurr(taxVal / 2)}
                </td>
                <td className="py-3 px-2 align-top text-right text-gray-600 tnum pt-4">
                  {formatCurr(taxVal / 2)}
                </td>
              </>
            ) : (
              <td className="py-3 px-2 align-top text-right text-gray-600 tnum pt-4">
                {formatCurr(taxVal)}
              </td>
            )}
          </>
        )}

        {/* Line Total */}
        <td className="py-3 px-3 align-top text-right font-bold text-purple-950 tnum pt-4">
          {formatCurr(total)}
        </td>

        {/* Delete Action */}
        <td className="py-3 px-2 align-top text-center pt-3.5">
          <button
            type="button"
            onClick={() => removeLine(line.id)}
            disabled={lines.length === 1}
            className="text-gray-300 hover:text-red-600 p-1 transition-colors disabled:opacity-0"
            title="Delete line"
          >
            <Icon name="trash" className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>
    );
  }

  // -------------------------------------------------------------
  // Submission & Saving
  // -------------------------------------------------------------
  async function handleSave(statusOverride?: string, redirectAction: 'view' | 'new' | 'stay' = 'view') {
    if (!clientId) {
      toast.error('Please select or add a client for this quotation.');
      return;
    }

    if (lines.some((l) => !l.name.trim() && !l.description.trim())) {
      toast.error('Please provide an item name or description for all line items.');
      return;
    }

    // Compile notes and attach any extra metadata (Custom Fields, Additional Info, Representative)
    let compiledNotes = showNotes ? notes : '';
    const extraMetadata: string[] = [];
    if (customFields.length > 0) {
      const cfText = customFields
        .filter((cf) => cf.label.trim() && cf.value.trim())
        .map((cf) => `${cf.label.trim()}: ${cf.value.trim()}`)
        .join(' | ');
      if (cfText) extraMetadata.push(`[Custom Fields] ${cfText}`);
    }
    if (showAdditionalInfo && additionalInfo.length > 0) {
      const aiText = additionalInfo
        .filter((ai) => ai.key.trim() && ai.value.trim())
        .map((ai) => `${ai.key.trim()}: ${ai.value.trim()}`)
        .join(' | ');
      if (aiText) extraMetadata.push(`[Additional Info] ${aiText}`);
    }
    if (showContactPerson && contactPerson.name.trim()) {
      extraMetadata.push(
        `[Contact Person] ${contactPerson.name.trim()}${contactPerson.phone ? ` (${contactPerson.phone})` : ''}${contactPerson.email ? ` <${contactPerson.email}>` : ''}`
      );
    }
    if (extraMetadata.length > 0) {
      compiledNotes = compiledNotes
        ? `${compiledNotes}\n\n${extraMetadata.join('\n')}`
        : extraMetadata.join('\n');
    }

    const payload = {
      clientId,
      currency,
      issueDate,
      expiryDate: expiryDate || undefined,
      discountType,
      discountValue: Number(discountValue) || 0,
      notes: compiledNotes || '',
      terms: showTerms ? terms : '',
      items: lines.map((l) => {
        const fullDesc = l.name.trim() + (l.description.trim() ? `\n${l.description.trim()}` : '');
        return {
          itemId: l.itemId,
          description: fullDesc || 'Item',
          quantity: Number(l.quantity) || 1,
          unit: l.unit || 'unit',
          rate: Number(l.rate) || 0,
          taxPercent: Number(l.taxPercent) || 0
        };
      })
    };

    setSaving(true);
    try {
      const doc = documentId
        ? await apiFetch<any>(`/api/quotations/${documentId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
          })
        : await apiFetch<any>('/api/quotations', {
            method: 'POST',
            body: JSON.stringify(payload)
          });

      toast.success(
        statusOverride === 'DRAFT'
          ? 'Quotation saved as Draft!'
          : documentId
          ? 'Quotation updated successfully!'
          : `Quotation ${doc.number || 'document'} created successfully!`
      );

      if (redirectAction === 'new') {
        router.push('/quotations/new');
        setQuoteNumber('');
        setLines([
          {
            id: genId(),
            groupId: null,
            itemId: null,
            name: '',
            description: '',
            showDescription: false,
            imageUrl: null,
            hsn: '',
            quantity: 1,
            unit: 'unit',
            rate: 0,
            taxPercent: settings?.defaultTaxPercent || 18,
            customValues: {}
          }
        ]);
      } else if (redirectAction === 'view') {
        router.push(`/quotations/${doc.id}`);
      } else if (redirectAction === 'stay') {
        if (!documentId && doc.id) {
          router.replace(`/quotations/${doc.id}/edit`);
        }
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save quotation.');
    } finally {
      setSaving(false);
    }
  }

  // Quick client creation
  const [newClientForm, setNewClientForm] = useState({
    name: '',
    email: '',
    phone: '',
    billingAddress: '',
    gstin: ''
  });
  const [savingClient, setSavingClient] = useState(false);

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    setSavingClient(true);
    try {
      const newClient = await apiFetch<Client>('/api/clients', {
        method: 'POST',
        body: JSON.stringify(newClientForm)
      });
      setClients((prev) => [...prev, newClient]);
      setClientId(newClient.id);
      setShowClientModal(false);
      setNewClientForm({ name: '', email: '', phone: '', billingAddress: '', gstin: '' });
      toast.success(`Client "${newClient.name}" created and selected!`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add client.');
    } finally {
      setSavingClient(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-slate-800 pb-32">
      {/* ========================================================= */}
      {/* 1. DOCUMENT HEADER & BRANDING (Top Section)               */}
      {/* ========================================================= */}
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <div className="bg-white rounded-t-xl shadow-xs border border-gray-200/90 p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Left Placement: Timeline & Identification */}
            <div className="md:col-span-7 space-y-4">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black text-brand-900 tracking-tight">
                  Quotation
                </h1>
                <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  BUILDER MODE
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Quotation No *
                  </label>
                  <input
                    type="text"
                    className="input text-xs font-bold text-brand-900 bg-gray-50/50"
                    value={quoteNumber}
                    onChange={(e) => setQuoteNumber(e.target.value)}
                    placeholder="QUO-0001"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Quotation Date *
                  </label>
                  <input
                    type="date"
                    className="input text-xs font-semibold text-brand-900 bg-gray-50/50"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Valid Till Date
                  </label>
                  <input
                    type="date"
                    className="input text-xs font-semibold text-brand-900 bg-gray-50/50"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Custom Fields list + button */}
              <div className="space-y-2 pt-1">
                {customFields.map((cf, idx) => (
                  <div key={cf.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      className="input py-1 text-xs w-1/3"
                      placeholder="Field Name (e.g. PO No)"
                      value={cf.label}
                      onChange={(e) => {
                        const updated = [...customFields];
                        updated[idx].label = e.target.value;
                        setCustomFields(updated);
                      }}
                    />
                    <input
                      type="text"
                      className="input py-1 text-xs flex-1"
                      placeholder="Value"
                      value={cf.value}
                      onChange={(e) => {
                        const updated = [...customFields];
                        updated[idx].value = e.target.value;
                        setCustomFields(updated);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setCustomFields((prev) => prev.filter((f) => f.id !== cf.id))}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Icon name="x" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setCustomFields((prev) => [
                      ...prev,
                      { id: genId(), label: 'PO Number', value: '' }
                    ])
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900 py-1"
                >
                  <Icon name="plus" className="w-3.5 h-3.5" />
                  + Add Custom Fields
                </button>
              </div>
            </div>

            {/* Right Placement: Prominent Dashed Rectangular Dropzone for Logo */}
            <div className="md:col-span-5 flex flex-col items-center sm:items-end justify-center">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleLogoFile(e.target.files[0]);
                }}
              />

              <div
                onClick={() => logoInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleLogoFile(e.dataTransfer.files[0]);
                }}
                className={`w-full max-w-[260px] h-32 border-2 rounded-xl flex flex-col items-center justify-center p-3 text-center cursor-pointer transition-all ${
                  logoUrl
                    ? 'border-purple-200 bg-white hover:border-purple-400 shadow-xs'
                    : 'border-dashed border-gray-300 bg-gray-50/60 hover:border-purple-500 hover:bg-purple-50/30'
                }`}
                title="Company Logo (Click or drag & drop to change)"
              >
                {logoUrl ? (
                  <div className="relative group w-full h-full flex flex-col items-center justify-center p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt={settings?.businessName || 'The Sprout Media'}
                      className="max-h-24 max-w-full object-contain"
                    />
                    <div className="absolute inset-0 bg-brand-900/60 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center gap-1.5 text-white transition-opacity backdrop-blur-[1px]">
                      <Icon name="edit" className="w-3.5 h-3.5" />
                      <span className="text-xs font-semibold">Change Logo</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center mb-1.5">
                      <Icon name="plus" className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-gray-700">Add Business Logo</span>
                    <span className="text-[10px] text-gray-400 mt-0.5">Drag &amp; drop or click to upload</span>
                  </>
                )}
              </div>

              {/* Status & Actions below Logo Dropzone */}
              {logoUrl ? (
                <div className="flex items-center justify-between w-full max-w-[260px] mt-1.5 px-0.5 text-[11px]">
                  <span className="text-gray-500 flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    {logoUrl === DEFAULT_LOGO_PATH ? 'The Sprout Media Logo' : 'Custom Logo'}
                  </span>
                  {logoUrl !== DEFAULT_LOGO_PATH ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleResetLogo();
                      }}
                      className="text-purple-700 hover:text-purple-900 font-semibold"
                    >
                      Reset to Sprout Media
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="text-purple-700 hover:text-purple-900 font-medium"
                    >
                      Change
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setLogoUrl(DEFAULT_LOGO_PATH)}
                  className="text-[11px] text-purple-700 hover:text-purple-900 font-semibold mt-1.5"
                >
                  Use The Sprout Media Logo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. ENTITY DETAILS (Upper Middle Section)                  */}
        {/* ========================================================= */}
        <div className="bg-white border-x border-gray-200/90 p-6 sm:p-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left Card: Quotation From */}
            <div className="rounded-xl border border-gray-200 bg-gray-50/40 p-5 relative">
              <div className="flex items-center justify-between mb-3 border-b border-gray-200/60 pb-2">
                <span className="text-xs font-black text-gray-700 uppercase tracking-wider">
                  Quotation From
                </span>
                <button
                  type="button"
                  onClick={() => setShowEditBusinessModal(true)}
                  className="text-xs font-semibold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1"
                >
                  <Icon name="edit" className="w-3.5 h-3.5" />
                  Edit
                </button>
              </div>

              <div className="text-xs space-y-1">
                <p className="font-bold text-sm text-brand-900">
                  {settings?.businessName || 'Your Business Name'}
                </p>
                {settings?.address && (
                  <p className="text-gray-600 whitespace-pre-line leading-relaxed">{settings.address}</p>
                )}
                {settings?.email && <p className="text-gray-600">{settings.email}</p>}
                {settings?.phone && <p className="text-gray-600">{settings.phone}</p>}
                {settings?.gstin && (
                  <p className="text-[11px] font-mono font-semibold text-purple-900 mt-1">
                    GSTIN: {settings.gstin}
                  </p>
                )}
              </div>
            </div>

            {/* Right Card: Quotation For */}
            <div className="rounded-xl border border-purple-200/80 bg-purple-50/20 p-5 relative flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-purple-200/50 pb-2">
                  <span className="text-xs font-black text-purple-950 uppercase tracking-wider">
                    Quotation For
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowClientModal(true)}
                    className="text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 px-2.5 py-1 rounded-md shadow-2xs inline-flex items-center gap-1 transition-colors"
                  >
                    <Icon name="plus" className="w-3 h-3" />
                    + Add New Client
                  </button>
                </div>

                <div className="mb-3">
                  <select
                    className="input text-xs font-semibold bg-white border-purple-300"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    required
                  >
                    <option value="">-- Select a Client --</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.email ? `(${c.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedClient ? (
                  <div className="text-xs space-y-0.5 text-gray-700 bg-white/80 p-3 rounded-lg border border-purple-100">
                    <p className="font-bold text-brand-900">{selectedClient.name}</p>
                    {selectedClient.billingAddress && (
                      <p className="text-gray-600 text-[11px] whitespace-pre-line leading-relaxed">
                        {selectedClient.billingAddress}
                      </p>
                    )}
                    {selectedClient.email && <p className="text-gray-600">{selectedClient.email}</p>}
                    {selectedClient.phone && <p className="text-gray-600">{selectedClient.phone}</p>}
                    {selectedClient.gstin && (
                      <p className="font-mono text-[10px] text-purple-800 font-semibold">
                        GSTIN: {selectedClient.gstin}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    Choose a client from the dropdown or click &quot;+ Add New Client&quot;.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Toggle: Add Shipping Details */}
          <div className="pt-2">
            <div className="flex items-center gap-2">
              <input
                id="toggleShipping"
                type="checkbox"
                checked={showShipping}
                onChange={(e) => setShowShipping(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
              />
              <label htmlFor="toggleShipping" className="text-xs font-bold text-gray-700 cursor-pointer">
                Add Shipping Details
              </label>
            </div>

            {showShipping && (
              <div className="mt-3 p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    id="sameAsBilling"
                    type="checkbox"
                    checked={shippingSameAsBilling}
                    onChange={(e) => {
                      setShippingSameAsBilling(e.target.checked);
                      if (e.target.checked && selectedClient?.billingAddress) {
                        setShippingAddress(selectedClient.billingAddress);
                      }
                    }}
                    className="w-3.5 h-3.5 text-purple-600 rounded border-gray-300"
                  />
                  <label htmlFor="sameAsBilling" className="text-xs text-gray-600 cursor-pointer">
                    Same as billing address
                  </label>
                </div>
                <textarea
                  rows={2}
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="Enter shipping address, dispatch site, or delivery destination…"
                  className="input text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. CONFIGURATION TOOLBAR (Mid Section)                   */}
        {/* ========================================================= */}
        <div className="bg-[#FAF5FF] border-x border-y border-purple-200 px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-purple-900">Currency:</span>
            <select
              className="text-xs font-bold text-purple-900 bg-white border border-purple-300 rounded-lg px-2.5 py-1.5 focus:outline-hidden"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="AED">AED (AED)</option>
            </select>
          </div>

          {/* Three Horizontally Aligned Modal Trigger Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGstModal(true)}
              className="btn-secondary py-1.5 px-3 text-xs font-semibold text-purple-800 bg-white border-purple-300 hover:bg-purple-100 flex items-center gap-1.5"
            >
              <span>%</span> Configure GST
            </button>

            <button
              type="button"
              onClick={() => setShowNumberFormatModal(true)}
              className="btn-secondary py-1.5 px-3 text-xs font-semibold text-purple-800 bg-white border-purple-300 hover:bg-purple-100 flex items-center gap-1.5"
            >
              <span>123</span> Number and Currency Format
            </button>

            <button
              type="button"
              onClick={() => setShowColumnsModal(true)}
              className="btn-secondary py-1.5 px-3 text-xs font-semibold text-purple-800 bg-white border-purple-300 hover:bg-purple-100 flex items-center gap-1.5"
            >
              <Icon name="settings" className="w-3.5 h-3.5" />
              Edit Columns / Formulas
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 4. LINE ITEM TABLE (Center Section)                      */}
        {/* ========================================================= */}
        <div className="bg-white border-x border-gray-200/90 p-4 sm:p-6 overflow-x-auto">
          <table className="w-full text-xs min-w-[780px] border border-gray-200 rounded-lg overflow-hidden">
            {/* Table Header: Solid Purple Banner */}
            <thead>
              <tr className="bg-[#4C1D95] text-white uppercase text-[10px] font-bold tracking-wider">
                <th className="py-3 px-3 text-left w-64">Item / Service</th>
                {columnConfig.hsn && (
                  <th className="py-3 px-2 text-center w-24 relative group">
                    <span>{columnConfig.hsnLabel}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteStandardColumn('hsn', columnConfig.hsnLabel)}
                      className="opacity-0 group-hover:opacity-100 absolute right-1 top-2.5 text-purple-200 hover:text-white transition-opacity"
                      title="Delete HSN column"
                    >
                      <Icon name="trash" className="w-2.5 h-2.5" />
                    </button>
                  </th>
                )}
                <th className="py-3 px-2 text-right w-16">Qty</th>
                {columnConfig.unit && (
                  <th className="py-3 px-2 text-center w-16 relative group">
                    <span>Unit</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteStandardColumn('unit', 'Unit')}
                      className="opacity-0 group-hover:opacity-100 absolute right-1 top-2.5 text-purple-200 hover:text-white transition-opacity"
                      title="Delete Unit column"
                    >
                      <Icon name="trash" className="w-2.5 h-2.5" />
                    </button>
                  </th>
                )}
                {columnConfig.rate && (
                  <th className="py-3 px-2 text-right w-24 relative group">
                    <span>{columnConfig.rateLabel}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteStandardColumn('rate', columnConfig.rateLabel)}
                      className="opacity-0 group-hover:opacity-100 absolute right-1 top-2.5 text-purple-200 hover:text-white transition-opacity"
                      title="Delete Rate column"
                    >
                      <Icon name="trash" className="w-2.5 h-2.5" />
                    </button>
                  </th>
                )}

                {/* Dynamic Custom Columns */}
                {customColumns.map((col) => (
                  <th
                    key={col.id}
                    className={`py-3 px-2 text-${col.align || 'left'} min-w-[100px] relative group`}
                  >
                    <span>{col.name}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomColumn(col.id, col.name)}
                      className="opacity-0 group-hover:opacity-100 absolute right-1 top-2.5 text-purple-200 hover:text-white transition-opacity"
                      title={`Delete ${col.name} column`}
                    >
                      <Icon name="trash" className="w-2.5 h-2.5" />
                    </button>
                  </th>
                ))}

                <th className="py-3 px-2 text-right w-24">Amount</th>
                {columnConfig.tax && (
                  <th className="py-3 px-2 text-center w-20 relative group">
                    <span>{columnConfig.taxLabel}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteStandardColumn('tax', columnConfig.taxLabel)}
                      className="opacity-0 group-hover:opacity-100 absolute right-1 top-2.5 text-purple-200 hover:text-white transition-opacity"
                      title="Delete GST Rate column"
                    >
                      <Icon name="trash" className="w-2.5 h-2.5" />
                    </button>
                  </th>
                )}

                {columnConfig.cgstSgst && (
                  <>
                    {gstConfig.taxMode === 'INTRASTATE' ? (
                      <>
                        <th className="py-3 px-2 text-right w-20 relative group">
                          <span>CGST</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteStandardColumn('cgstSgst', 'CGST/SGST')}
                            className="opacity-0 group-hover:opacity-100 absolute right-1 top-2.5 text-purple-200 hover:text-white transition-opacity"
                            title="Delete CGST/SGST column"
                          >
                            <Icon name="trash" className="w-2.5 h-2.5" />
                          </button>
                        </th>
                        <th className="py-3 px-2 text-right w-20">SGST</th>
                      </>
                    ) : (
                      <th className="py-3 px-2 text-right w-24 relative group">
                        <span>IGST</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteStandardColumn('cgstSgst', 'IGST')}
                          className="opacity-0 group-hover:opacity-100 absolute right-1 top-2.5 text-purple-200 hover:text-white transition-opacity"
                          title="Delete IGST column"
                        >
                          <Icon name="trash" className="w-2.5 h-2.5" />
                        </button>
                      </th>
                    )}
                  </>
                )}

                <th className="py-3 px-3 text-right w-28">Total</th>
                <th className="py-3 px-1.5 text-center w-12">
                  <button
                    type="button"
                    onClick={() => setShowColumnsModal(true)}
                    className="p-1 rounded bg-purple-700/50 hover:bg-purple-700 text-white transition-colors"
                    title="+ Add or Edit Columns"
                  >
                    <Icon name="plus" className="w-3 h-3" />
                  </button>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {groups.length === 0 ? (
                lines.map((line, idx) => renderLineRow(line, idx))
              ) : (
                <>
                  {/* Ungrouped items (if any) */}
                  {lines.filter((l) => !l.groupId).map((line, idx) => renderLineRow(line, idx))}

                  {/* Group sections */}
                  {groups.map((group) => {
                    const groupLines = lines.filter((l) => l.groupId === group.id);
                    const groupSubtotal = groupLines.reduce(
                      (acc, l) => acc + (Number(l.quantity) || 0) * (Number(l.rate) || 0),
                      0
                    );
                    const groupTax = groupLines.reduce((acc, l) => {
                      const s = (Number(l.quantity) || 0) * (Number(l.rate) || 0);
                      return acc + (s * (Number(l.taxPercent) || 0)) / 100;
                    }, 0);
                    const groupTotal = groupSubtotal + groupTax;

                    return (
                      <Fragment key={group.id}>
                        {/* Group Header Banner */}
                        <tr className="bg-purple-100/75 border-y-2 border-purple-200">
                          <td colSpan={calcTotalCols()} className="py-2.5 px-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 flex-1 max-w-lg">
                                <span className="w-3 h-3 rounded-full bg-purple-700 shrink-0"></span>
                                <input
                                  type="text"
                                  className="input py-1 px-2.5 text-xs font-bold text-purple-950 bg-white border border-purple-300 w-full rounded-md shadow-2xs"
                                  value={group.title}
                                  onChange={(e) => updateGroupTitle(group.id, e.target.value)}
                                  placeholder="Group Title (e.g. Phase 1: Brand Strategy & Design)"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => addLine(group.id)}
                                  className="btn-secondary py-1 px-3 text-xs font-bold text-purple-800 bg-white border-purple-300 hover:bg-purple-50 flex items-center gap-1 shadow-2xs rounded-md"
                                  title="Add new line item into this group"
                                >
                                  <Icon name="plus" className="w-3 h-3" />
                                  + Add Item to Group
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeGroup(group.id)}
                                  className="text-red-600 hover:text-red-800 hover:bg-red-100/70 py-1 px-2.5 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors border border-red-200 bg-white"
                                  title="Delete this group and its items"
                                >
                                  <Icon name="trash" className="w-3 h-3" />
                                  Delete Group
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Items in this group */}
                        {groupLines.map((line, idx) => renderLineRow(line, idx))}

                        {/* Group Subtotal Row */}
                        {!advancedOptions.hideGroupSubtotals && (
                          <tr className="bg-purple-50/50 border-b border-purple-200 text-xs font-medium">
                            <td
                              colSpan={calcTotalCols() - 2}
                              className="py-2.5 px-4 text-right text-purple-900 font-bold"
                            >
                              Subtotal for &quot;{group.title}&quot; ({groupLines.length}{' '}
                              {groupLines.length === 1 ? 'item' : 'items'}):
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-purple-950 tnum">
                              {formatCurr(groupTotal)}
                            </td>
                            <td></td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </>
              )}
            </tbody>
          </table>

          {/* Table Actions: Below the table centered/left buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => addLine()}
                className="btn-primary py-2 px-4 text-xs font-bold bg-[#4C1D95] hover:bg-[#3B1F75] flex items-center gap-1.5 shadow-xs"
              >
                <Icon name="plus" className="w-3.5 h-3.5" />
                + Add New Line
              </button>

              <button
                type="button"
                onClick={addGroup}
                className="btn-secondary py-2 px-4 text-xs font-semibold text-purple-800 border-purple-300 hover:bg-purple-50 flex items-center gap-1.5"
              >
                <Icon name="plus" className="w-3.5 h-3.5" />
                + Add New Group
              </button>
            </div>

            {catalog.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-gray-500 font-medium">Add from Catalog:</span>
                <select
                  className="input py-1 text-xs w-auto bg-gray-50 font-semibold"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) insertCatalogItem(e.target.value);
                  }}
                >
                  <option value="">Choose Catalog Item…</option>
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({formatMoney(c.rateCents, currency)})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* 5. PAYMENT DETAILS & FINANCIAL SUMMARY (Lower Section)    */}
        {/* ========================================================= */}
        <div className="bg-white border-x border-gray-200/90 p-6 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Payment Modules (Bank + UPI) */}
            <div className="lg:col-span-6 space-y-4">
              <h3 className="text-xs font-black text-gray-700 uppercase tracking-wider">
                Payment Details &amp; Rails
              </h3>

              {/* Card 1: Add Bank Account Details */}
              <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="wallet" className="w-4 h-4 text-purple-700" />
                    <span className="text-xs font-bold text-brand-900">Bank Account Details</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={bankDetails.enabled}
                    onChange={(e) => setBankDetails({ ...bankDetails, enabled: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                </div>

                {bankDetails.enabled && (
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <input
                      type="text"
                      placeholder="Bank Name (e.g. HDFC Bank)"
                      className="input py-1 text-xs"
                      value={bankDetails.bankName}
                      onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                    />
                    <input
                      type="text"
                      placeholder="Account Number"
                      className="input py-1 text-xs font-mono"
                      value={bankDetails.accountNumber}
                      onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
                    />
                    <input
                      type="text"
                      placeholder="IFSC Code"
                      className="input py-1 text-xs font-mono uppercase"
                      value={bankDetails.ifscCode}
                      onChange={(e) => setBankDetails({ ...bankDetails, ifscCode: e.target.value })}
                    />
                    <input
                      type="text"
                      placeholder="Account Holder Name"
                      className="input py-1 text-xs"
                      value={bankDetails.accountHolder}
                      onChange={(e) => setBankDetails({ ...bankDetails, accountHolder: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* Card 2: Add UPI Details + Live QR Code */}
              <div className="rounded-xl border border-purple-200 p-4 bg-purple-50/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-900">⚡ Add UPI Details (Instant Pay)</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={upiDetails.enabled}
                    onChange={(e) => setUpiDetails({ ...upiDetails, enabled: e.target.checked })}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                </div>

                {upiDetails.enabled && (
                  <div className="flex flex-col sm:flex-row gap-4 items-center pt-1">
                    <div className="flex-1 space-y-2 w-full text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">UPI ID / VPA</label>
                        <input
                          type="text"
                          placeholder="sprout@upi"
                          className="input py-1 text-xs font-mono"
                          value={upiDetails.upiId}
                          onChange={(e) => setUpiDetails({ ...upiDetails, upiId: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Payee Name</label>
                        <input
                          type="text"
                          placeholder="The Sprout Media"
                          className="input py-1 text-xs"
                          value={upiDetails.payeeName}
                          onChange={(e) => setUpiDetails({ ...upiDetails, payeeName: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Live Generated QR Code */}
                    {upiDetails.upiId ? (
                      <div className="shrink-0 p-2 bg-white rounded-lg border border-purple-200 shadow-2xs text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${encodeURIComponent(
                            `upi://pay?pa=${upiDetails.upiId}&pn=${encodeURIComponent(
                              upiDetails.payeeName || 'Business'
                            )}&am=${totals.finalTotal.toFixed(2)}&cu=${currency}`
                          )}`}
                          alt="UPI QR Code"
                          className="w-24 h-24 object-contain"
                        />
                        <span className="text-[9px] font-bold text-purple-900 block mt-1">Scan &amp; Pay</span>
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-lg border-2 border-dashed border-purple-200 flex items-center justify-center text-[10px] text-purple-400 text-center p-2">
                        Enter UPI ID for QR Code
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Financial Summary Block */}
            <div className="lg:col-span-6 space-y-3 bg-gray-50/70 p-5 rounded-xl border border-gray-200 text-xs">
              <div className="flex justify-between py-1 text-gray-600">
                <span>Subtotal</span>
                <span className="font-semibold text-brand-900 tnum">{formatCurr(totals.subtotal)}</span>
              </div>

              {/* Expandable: Add Discounts */}
              <div className="border-t border-gray-200/80 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDiscountsBlock(!showDiscountsBlock)}
                  className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center justify-between w-full"
                >
                  <span>{showDiscountsBlock ? '▼ Discounts' : '+ Add Discounts'}</span>
                  {totals.discount > 0 && (
                    <span className="text-emerald-700 font-bold tnum">-{formatCurr(totals.discount)}</span>
                  )}
                </button>

                {showDiscountsBlock && (
                  <div className="flex items-center gap-2 mt-2 pt-1">
                    <select
                      className="input py-1 text-xs w-32"
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value as any)}
                    >
                      <option value="NONE">No Discount</option>
                      <option value="PERCENT">% Percentage</option>
                      <option value="FLAT">Flat Amount</option>
                    </select>

                    {discountType !== 'NONE' && (
                      <input
                        type="number"
                        min="0"
                        className="input py-1 text-xs w-28 text-right font-bold"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(Number(e.target.value))}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Expandable: Add Additional Charges */}
              <div className="border-t border-gray-200/80 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdditionalChargesBlock(!showAdditionalChargesBlock)}
                  className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center justify-between w-full"
                >
                  <span>{showAdditionalChargesBlock ? '▼ Additional Charges' : '+ Add Additional Charges'}</span>
                  {totals.totalAdditionalCharges > 0 && (
                    <span className="font-bold text-gray-800 tnum">+{formatCurr(totals.totalAdditionalCharges)}</span>
                  )}
                </button>

                {showAdditionalChargesBlock && (
                  <div className="space-y-2 mt-2 pt-1">
                    {additionalCharges.map((ac, i) => (
                      <div key={ac.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="e.g. Shipping / Packaging"
                          className="input py-1 text-xs flex-1"
                          value={ac.label}
                          onChange={(e) => {
                            const updated = [...additionalCharges];
                            updated[i].label = e.target.value;
                            setAdditionalCharges(updated);
                          }}
                        />
                        <input
                          type="number"
                          placeholder="Amount"
                          className="input py-1 text-xs w-24 text-right"
                          value={ac.amount}
                          onChange={(e) => {
                            const updated = [...additionalCharges];
                            updated[i].amount = Number(e.target.value);
                            setAdditionalCharges(updated);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setAdditionalCharges((prev) => prev.filter((a) => a.id !== ac.id))}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Icon name="x" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        setAdditionalCharges((prev) => [
                          ...prev,
                          { id: genId(), label: 'Shipping & Delivery', amount: 0 }
                        ])
                      }
                      className="text-[11px] font-semibold text-purple-700 hover:underline"
                    >
                      + Add Charge Row
                    </button>
                  </div>
                )}
              </div>

              {/* Tax Details */}
              <div className="border-t border-gray-200/80 pt-2 space-y-1">
                {gstConfig.taxMode === 'INTRASTATE' ? (
                  <>
                    <div className="flex justify-between text-gray-500">
                      <span>CGST Total</span>
                      <span className="tnum">{formatCurr(totals.cgstTotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>SGST Total</span>
                      <span className="tnum">{formatCurr(totals.sgstTotal)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-gray-500">
                    <span>IGST Total</span>
                    <span className="tnum">{formatCurr(totals.igstTotal)}</span>
                  </div>
                )}
              </div>

              {/* Round Off */}
              {totals.roundOff !== 0 && (
                <div className="flex justify-between text-gray-500 pt-1">
                  <span>Round Off</span>
                  <span className="tnum">{formatCurr(totals.roundOff)}</span>
                </div>
              )}

              {/* Final Total (Prominently Displayed) */}
              <div className="border-t-2 border-purple-900 pt-3 flex justify-between items-baseline">
                <span className="text-sm font-black uppercase text-purple-950">Total ({currency})</span>
                <span className="text-xl sm:text-2xl font-black text-purple-950 tnum">
                  {formatCurr(totals.finalTotal)}
                </span>
              </div>

              {/* Automated Total in words */}
              {!advancedOptions.hideTotalInWords && (
                <div className="pt-2 border-t border-gray-200/60">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Total (in words)
                  </span>
                  <p className="text-xs font-bold text-gray-800 leading-snug">
                    {amountInWords(totals.totalCents, currency)}
                  </p>
                </div>
              )}

              {/* Add Signature Button / Block */}
              <div className="pt-3 border-t border-gray-200/80">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600">Signature</span>
                  <button
                    type="button"
                    onClick={() => setShowSignatureModal(true)}
                    className="text-xs font-semibold text-purple-700 hover:text-purple-900 flex items-center gap-1"
                  >
                    <Icon name="edit" className="w-3.5 h-3.5" />
                    {signatureData.imageUrl || signatureData.signatoryName
                      ? 'Edit Signature'
                      : '+ Add Signature'}
                  </button>
                </div>

                {(signatureData.imageUrl || signatureData.signatoryName) && (
                  <div className="mt-2 p-3 bg-white rounded-lg border border-gray-200 text-center">
                    {signatureData.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={signatureData.imageUrl}
                        alt="Signature"
                        className="h-12 max-w-[140px] mx-auto object-contain mb-1"
                      />
                    )}
                    {signatureData.signatoryName && (
                      <p className="text-xs font-bold text-gray-800">{signatureData.signatoryName}</p>
                    )}
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                      {signatureData.designation}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 6. DOCUMENT MODIFIERS & ADVANCED OPTIONS (Bottom Section) */}
        {/* ========================================================= */}
        <div className="bg-white border-x border-b border-gray-200/90 rounded-b-xl p-6 sm:p-8 space-y-6">
          {/* Modular Content Buttons (Pill-shaped) */}
          <div className="space-y-2">
            <span className="text-xs font-black text-gray-700 uppercase tracking-wider block">
              Document Modifiers &amp; Modules
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowTerms(!showTerms)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  showTerms
                    ? 'bg-purple-800 text-white border-purple-800 shadow-2xs'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                }`}
              >
                {showTerms ? '✓ Terms & Conditions' : '+ Add Terms & Conditions'}
              </button>

              <button
                type="button"
                onClick={() => setShowNotes(!showNotes)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  showNotes
                    ? 'bg-purple-800 text-white border-purple-800 shadow-2xs'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                }`}
              >
                {showNotes ? '✓ Notes' : '+ Add Notes'}
              </button>

              <button
                type="button"
                onClick={() => setShowAttachments(!showAttachments)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  showAttachments
                    ? 'bg-purple-800 text-white border-purple-800 shadow-2xs'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                }`}
              >
                {showAttachments ? '✓ Attachments' : '+ Add Attachments'}
              </button>

              <button
                type="button"
                onClick={() => setShowAdditionalInfo(!showAdditionalInfo)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  showAdditionalInfo
                    ? 'bg-purple-800 text-white border-purple-800 shadow-2xs'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                }`}
              >
                {showAdditionalInfo ? '✓ Additional Info' : '+ Add Additional Info'}
              </button>

              <button
                type="button"
                onClick={() => setShowContactPerson(!showContactPerson)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  showContactPerson
                    ? 'bg-purple-800 text-white border-purple-800 shadow-2xs'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                }`}
              >
                {showContactPerson ? '✓ Contact Details' : '+ Add Contact Details'}
              </button>
            </div>
          </div>

          {/* Expanded Modular Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Terms & Conditions Block */}
            {showTerms && (
              <div className="space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <label className="font-bold text-gray-700">Terms &amp; Conditions</label>
                    <span className="text-[10px] text-gray-400 font-normal hidden sm:inline">
                      (Supports bullet points &amp; numbered terms)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleAddBulletToTerms}
                      className="px-2 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-semibold text-[11px] inline-flex items-center gap-1 transition-colors"
                      title="Insert a bullet point"
                    >
                      <span className="text-sm font-bold leading-none">•</span>
                      Add Bullet Point
                    </button>
                    <button
                      type="button"
                      onClick={handleAddNumberToTerms}
                      className="px-2 py-0.5 rounded bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 font-semibold text-[11px] inline-flex items-center gap-1 transition-colors"
                      title="Insert a numbered point"
                    >
                      <span className="text-xs font-bold leading-none">1.</span>
                      Numbered Point
                    </button>
                    {terms.trim() && (
                      <button
                        type="button"
                        onClick={handleConvertTermsToBullets}
                        className="px-2 py-0.5 rounded bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 text-[10px] hover:text-purple-700 transition-colors"
                        title="Format all lines as bullet points"
                      >
                        Convert to Bullets
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const defaultQuoteTerms =
                          standardTerms ||
                          '• 50% advance payment required upon quotation acceptance.\n• Quotation is valid for 30 days from the date of issue.\n• Estimated project delivery within agreed timeline after receiving all assets.\n• Applicable taxes (GST) will be charged as per prevailing government norms.\n• Any additional work or scope changes will be quoted separately.';
                        setTerms(defaultQuoteTerms);
                        toast.success('Standard quotation terms loaded.');
                      }}
                      className="text-[11px] text-purple-700 hover:underline font-semibold ml-1"
                    >
                      Use Standard Terms
                    </button>
                  </div>
                </div>
                <textarea
                  rows={6}
                  className="input p-3 text-xs sm:text-sm w-full min-h-[140px] resize-y text-gray-800 leading-relaxed bg-white border border-gray-300 rounded-md focus:border-purple-600 focus:ring-1 focus:ring-purple-600 shadow-inner"
                  placeholder="• 50% advance payment required upon quotation acceptance.&#10;• Quotation is valid for 30 days from issue date. (Press Enter to continue bullets)"
                  value={terms}
                  onKeyDown={handleTermsKeyDown}
                  onChange={(e) => setTerms(e.target.value)}
                />
                <p className="text-[10px] text-gray-400 italic">
                  Tip: Press <kbd className="px-1 py-0.5 bg-gray-100 border rounded text-[9px] font-mono">Enter</kbd> to automatically add the next bullet or number.
                </p>
              </div>
            )}

            {/* Notes Block */}
            {showNotes && (
              <div className="space-y-1.5 text-xs">
                <label className="font-bold text-gray-700">Client Notes &amp; Remarks</label>
                <textarea
                  rows={4}
                  className="input text-xs"
                  placeholder="Thank you for giving us the opportunity to quote. Reach out for any questions!"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            )}

            {/* Attachments Block */}
            {showAttachments && (
              <div className="space-y-2 text-xs">
                <label className="font-bold text-gray-700">Attachments &amp; References</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Link or document URL (e.g. portfolio.pdf)"
                    className="input py-1 text-xs flex-1"
                    value={attachmentInput}
                    onChange={(e) => setAttachmentInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAttachment();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddAttachment}
                    className="btn-primary py-1 px-3 text-xs font-bold"
                  >
                    + Add Link
                  </button>
                  <label className="btn-secondary py-1 px-3 text-xs font-semibold cursor-pointer flex items-center gap-1">
                    <Icon name="plus" className="w-3 h-3" />
                    Upload File
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setAttachments((prev) => [
                            ...prev,
                            { id: genId(), name: file.name, url: file.name }
                          ]);
                          toast.success(`Attached "${file.name}"`);
                        }
                      }}
                    />
                  </label>
                </div>
                <ul className="space-y-1">
                  {attachments.map((att) => (
                    <li key={att.id} className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded">
                      <span className="truncate">{att.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                        className="text-gray-400 hover:text-red-500"
                        title="Remove attachment"
                      >
                        <Icon name="x" className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Additional Info Block */}
            {showAdditionalInfo && (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-700">Additional Info &amp; Custom Fields</label>
                  <button
                    type="button"
                    onClick={() => setAdditionalInfo((prev) => [...prev, { id: genId(), key: '', value: '' }])}
                    className="text-[11px] font-semibold text-purple-700 hover:underline flex items-center gap-1"
                  >
                    <Icon name="plus" className="w-3 h-3" />
                    + Add Field
                  </button>
                </div>
                {additionalInfo.length === 0 ? (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-center text-gray-500">
                    <p className="text-xs">No additional fields added yet.</p>
                    <button
                      type="button"
                      onClick={() =>
                        setAdditionalInfo([
                          { id: genId(), key: 'Project Timeline', value: '4-6 Weeks' },
                          { id: genId(), key: 'Payment Milestones', value: '50% Advance, 50% on Handover' }
                        ])
                      }
                      className="text-[11px] text-purple-700 font-semibold hover:underline mt-1"
                    >
                      + Insert Common Milestones &amp; Timeline
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {additionalInfo.map((info, idx) => (
                      <div key={info.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Field Name (e.g. Warranty)"
                          className="input py-1 text-xs w-1/3"
                          value={info.key}
                          onChange={(e) => {
                            const updated = [...additionalInfo];
                            updated[idx].key = e.target.value;
                            setAdditionalInfo(updated);
                          }}
                        />
                        <input
                          type="text"
                          placeholder="Field Value (e.g. 1 Year Comprehensive)"
                          className="input py-1 text-xs flex-1"
                          value={info.value}
                          onChange={(e) => {
                            const updated = [...additionalInfo];
                            updated[idx].value = e.target.value;
                            setAdditionalInfo(updated);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setAdditionalInfo((prev) => prev.filter((item) => item.id !== info.id))}
                          className="text-gray-400 hover:text-red-500 p-1"
                          title="Remove field"
                        >
                          <Icon name="x" className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Contact Person Details Block */}
            {showContactPerson && (
              <div className="space-y-2 text-xs">
                <label className="font-bold text-gray-700">Representative Contact Card</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Contact Name"
                    className="input py-1 text-xs col-span-2"
                    value={contactPerson.name}
                    onChange={(e) => setContactPerson({ ...contactPerson, name: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Phone"
                    className="input py-1 text-xs"
                    value={contactPerson.phone}
                    onChange={(e) => setContactPerson({ ...contactPerson, phone: e.target.value })}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    className="input py-1 text-xs"
                    value={contactPerson.email}
                    onChange={(e) => setContactPerson({ ...contactPerson, email: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Advanced Options List: Vertical Checkboxes ("Do not show on document") */}
          <div className="border-t border-gray-200/90 pt-4">
            <span className="text-xs font-black text-gray-600 uppercase tracking-wider block mb-2">
              Advanced Presentation Options (Do Not Show on Output)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs text-gray-600">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={advancedOptions.hideHsn}
                  onChange={(e) => setAdvancedOptions({ ...advancedOptions, hideHsn: e.target.checked })}
                  className="rounded border-gray-300 text-purple-600"
                />
                <span>Do not show HSN/SAC codes</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={advancedOptions.hideImages}
                  onChange={(e) => setAdvancedOptions({ ...advancedOptions, hideImages: e.target.checked })}
                  className="rounded border-gray-300 text-purple-600"
                />
                <span>Do not show item thumbnails</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={advancedOptions.hideTaxBreakdown}
                  onChange={(e) => setAdvancedOptions({ ...advancedOptions, hideTaxBreakdown: e.target.checked })}
                  className="rounded border-gray-300 text-purple-600"
                />
                <span>Do not show tax breakdown</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={advancedOptions.hideBankDetails}
                  onChange={(e) => setAdvancedOptions({ ...advancedOptions, hideBankDetails: e.target.checked })}
                  className="rounded border-gray-300 text-purple-600"
                />
                <span>Do not show bank details</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={advancedOptions.hideUpiQr}
                  onChange={(e) => setAdvancedOptions({ ...advancedOptions, hideUpiQr: e.target.checked })}
                  className="rounded border-gray-300 text-purple-600"
                />
                <span>Do not show UPI QR code</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={advancedOptions.hideTotalInWords}
                  onChange={(e) => setAdvancedOptions({ ...advancedOptions, hideTotalInWords: e.target.checked })}
                  className="rounded border-gray-300 text-purple-600"
                />
                <span>Do not show total in words</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ACTION FOOTER (Sticky at very bottom)                     */}
      {/* ========================================================= */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/90 px-4 sm:px-8 py-3.5 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href="/quotations"
              className="btn-secondary py-2 px-4 text-xs font-semibold"
            >
              Cancel &amp; Discard
            </Link>
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave('DRAFT', 'stay')}
              className="btn-secondary py-2 px-4 text-xs font-semibold"
            >
              Save As Draft
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(undefined, 'new')}
              className="btn-secondary py-2 px-4 text-xs font-bold text-purple-900 border-purple-300 hover:bg-purple-50"
            >
              Save &amp; Create New
            </button>

            {/* Primary Action Button (Highlighted in Pink/Purple per report) */}
            <button
              type="button"
              disabled={saving}
              onClick={() => handleSave(undefined, 'view')}
              className="py-2.5 px-6 rounded-lg text-xs sm:text-sm font-black text-white bg-gradient-to-r from-pink-600 to-purple-700 hover:from-pink-500 hover:to-purple-600 shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2"
            >
              <Icon name="check" className="w-4 h-4" />
              {saving ? 'Saving Quotation…' : 'Save & Continue'}
            </button>
          </div>
        </div>
      </footer>

      {/* Floating Action Button (Chat/Help Icon in Bottom Right) */}
      <div className="fixed bottom-20 right-6 z-50">
        <button
          type="button"
          onClick={() =>
            toast.info('Need help? All changes are saved automatically to your local JSON database!')
          }
          className="w-12 h-12 rounded-full bg-purple-900 hover:bg-purple-950 text-white shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
          title="Builder Help & Tips"
        >
          <Icon name="mail" className="w-5 h-5" />
        </button>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: % Configure GST                                 */}
      {/* ========================================================= */}
      {showGstModal && (
        <Modal title="% Configure Regional GST Settings" onClose={() => setShowGstModal(false)}>
          <div className="space-y-4 text-xs">
            <div>
              <label className="label">Place of Supply (State / Union Territory)</label>
              <select
                className="input text-xs"
                value={gstConfig.placeOfSupply}
                onChange={(e) => setGstConfig({ ...gstConfig, placeOfSupply: e.target.value })}
              >
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Tax Application Mode</label>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setGstConfig({ ...gstConfig, taxMode: 'INTRASTATE' })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    gstConfig.taxMode === 'INTRASTATE'
                      ? 'border-purple-600 bg-purple-50/50 font-bold text-purple-950'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-bold">Intrastate (CGST + SGST)</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Supplier &amp; client in same state (split 50/50)</p>
                </button>

                <button
                  type="button"
                  onClick={() => setGstConfig({ ...gstConfig, taxMode: 'INTERSTATE' })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    gstConfig.taxMode === 'INTERSTATE'
                      ? 'border-purple-600 bg-purple-50/50 font-bold text-purple-950'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="font-bold">Interstate (IGST)</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">Supplier &amp; client in different states (Single tax)</p>
                </button>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-800">Reverse Charge Mechanism (RCM)</p>
                <p className="text-[10px] text-gray-500">Tax is payable by recipient directly to government</p>
              </div>
              <input
                type="checkbox"
                checked={gstConfig.rcm}
                onChange={(e) => setGstConfig({ ...gstConfig, rcm: e.target.checked })}
                className="w-4 h-4 text-purple-600 rounded"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                className="btn-primary py-1.5 px-4 text-xs font-bold"
                onClick={() => {
                  setShowGstModal(false);
                  toast.success('Regional GST settings applied.');
                }}
              >
                Apply GST Configuration
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: 123 Number & Currency Format                     */}
      {/* ========================================================= */}
      {showNumberFormatModal && (
        <Modal title="123 Number and Currency Formatting" onClose={() => setShowNumberFormatModal(false)}>
          <div className="space-y-4 text-xs">
            <div>
              <label className="label">Numbering System</label>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setNumberFormat({ ...numberFormat, numberingSystem: 'INDIAN' })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    numberFormat.numberingSystem === 'INDIAN'
                      ? 'border-purple-600 bg-purple-50 font-bold text-purple-950'
                      : 'border-gray-200'
                  }`}
                >
                  <p className="font-bold">Indian (Lakhs &amp; Crores)</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">₹ 1,00,000.00</p>
                </button>

                <button
                  type="button"
                  onClick={() => setNumberFormat({ ...numberFormat, numberingSystem: 'INTERNATIONAL' })}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    numberFormat.numberingSystem === 'INTERNATIONAL'
                      ? 'border-purple-600 bg-purple-50 font-bold text-purple-950'
                      : 'border-gray-200'
                  }`}
                >
                  <p className="font-bold">International (Millions)</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">$ 100,000.00</p>
                </button>
              </div>
            </div>

            <div>
              <label className="label">Decimal Precision</label>
              <div className="flex gap-3 mt-1">
                {([0, 2, 3] as const).map((dec) => (
                  <button
                    key={dec}
                    type="button"
                    onClick={() => setNumberFormat({ ...numberFormat, decimalPrecision: dec })}
                    className={`flex-1 py-2 rounded-lg border text-center font-bold ${
                      numberFormat.decimalPrecision === dec
                        ? 'border-purple-600 bg-purple-50 text-purple-950'
                        : 'border-gray-200'
                    }`}
                  >
                    {dec} Decimals
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Rounding Rules</label>
              <select
                className="input text-xs mt-1"
                value={numberFormat.roundingRule}
                onChange={(e) => setNumberFormat({ ...numberFormat, roundingRule: e.target.value as any })}
              >
                <option value="NORMAL">Standard Rounding (0.5+ rounds up)</option>
                <option value="UP">Always Round Up (Ceil)</option>
                <option value="DOWN">Always Round Down (Floor)</option>
                <option value="NONE">No Rounding (Exact cents)</option>
              </select>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                className="btn-primary py-1.5 px-4 text-xs font-bold"
                onClick={() => {
                  setShowNumberFormatModal(false);
                  toast.success('Number and currency formatting saved.');
                }}
              >
                Save Formatting
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: Edit Columns & Formulas Engine                   */}
      {/* ========================================================= */}
      {showColumnsModal && (
        <Modal wide title="Edit Columns and Mathematical Formulas" onClose={() => setShowColumnsModal(false)}>
          <div className="space-y-5 text-xs">
            {/* Header description */}
            <div className="bg-purple-50/70 border border-purple-100 rounded-lg p-3 text-purple-900 flex items-start gap-2.5">
              <Icon name="settings" className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Customize Line Item Table Columns &amp; Formulas</p>
                <p className="text-[11px] text-purple-700 mt-0.5">
                  Add custom columns (Text, Number, Currency, or Dynamic Formulas) or delete and restore standard columns. Changes reflect instantly on your quotation document.
                </p>
              </div>
            </div>

            {/* Section 1: Active Columns with Delete actions and in-place rename */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0 text-gray-800 font-bold flex items-center gap-1.5">
                  <span>Active Columns in Document</span>
                  <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {(columnConfig.hsn ? 1 : 0) +
                      1 +
                      (columnConfig.unit ? 1 : 0) +
                      (columnConfig.rate ? 1 : 0) +
                      customColumns.length +
                      1 +
                      (columnConfig.tax ? 1 : 0) +
                      (columnConfig.cgstSgst ? 1 : 0) +
                      1}{' '}
                    columns
                  </span>
                </label>
                <span className="text-[10px] text-gray-400">Click &quot;Delete Column&quot; to remove any column from the table</span>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100 bg-white">
                {/* Standard Required: Item / Service */}
                <div className="p-2.5 px-3 flex items-center justify-between bg-gray-50/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-semibold text-gray-800">Item / Service Details</span>
                    <span className="text-[10px] bg-gray-200/80 text-gray-700 px-1.5 py-0.5 rounded font-medium">Core Required</span>
                  </div>
                  <span className="text-[11px] text-gray-400 italic">Always visible</span>
                </div>

                {/* Standard Column: HSN / SAC */}
                {columnConfig.hsn && (
                  <div className="p-2.5 px-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <input
                        type="text"
                        className="input py-0.5 px-2 text-xs font-medium w-36"
                        value={columnConfig.hsnLabel}
                        onChange={(e) => setColumnConfig({ ...columnConfig, hsnLabel: e.target.value })}
                        placeholder="HSN/SAC"
                        title="Rename column header"
                      />
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">Standard (Code)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteStandardColumn('hsn', columnConfig.hsnLabel)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                      title="Delete HSN/SAC column"
                    >
                      <Icon name="trash" className="w-3 h-3" />
                      Delete Column
                    </button>
                  </div>
                )}

                {/* Standard Required: Quantity */}
                <div className="p-2.5 px-3 flex items-center justify-between bg-gray-50/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-semibold text-gray-800">Quantity (Qty)</span>
                    <span className="text-[10px] bg-gray-200/80 text-gray-700 px-1.5 py-0.5 rounded font-medium">Core Required</span>
                  </div>
                  <span className="text-[11px] text-gray-400 italic">Always visible</span>
                </div>

                {/* Standard Column: Unit */}
                {columnConfig.unit && (
                  <div className="p-2.5 px-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span className="font-medium text-gray-800 w-36">Unit (Measurement)</span>
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">Standard (Text)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteStandardColumn('unit', 'Unit')}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                      title="Delete Unit column"
                    >
                      <Icon name="trash" className="w-3 h-3" />
                      Delete Column
                    </button>
                  </div>
                )}

                {/* Standard Column: Rate */}
                {columnConfig.rate && (
                  <div className="p-2.5 px-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <input
                        type="text"
                        className="input py-0.5 px-2 text-xs font-medium w-36"
                        value={columnConfig.rateLabel}
                        onChange={(e) => setColumnConfig({ ...columnConfig, rateLabel: e.target.value })}
                        placeholder="Rate"
                        title="Rename column header"
                      />
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">Standard (Currency)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteStandardColumn('rate', columnConfig.rateLabel)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                      title="Delete Rate column"
                    >
                      <Icon name="trash" className="w-3 h-3" />
                      Delete Column
                    </button>
                  </div>
                )}

                {/* Custom Columns added by User */}
                {customColumns.map((col) => (
                  <div key={col.id} className="p-2.5 px-3 flex items-center justify-between bg-purple-50/30 hover:bg-purple-50/50 transition-colors">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                      <input
                        type="text"
                        className="input py-0.5 px-2 text-xs font-semibold w-40 text-purple-950 border-purple-200"
                        value={col.name}
                        onChange={(e) => handleUpdateCustomColumn(col.id, { name: e.target.value })}
                        placeholder="Column Name"
                        title="Rename custom column header"
                      />
                      <span className="text-[10px] bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded">
                        Custom: {col.type}
                      </span>
                      {col.type === 'FORMULA' && (
                        <span className="text-[10px] font-mono text-purple-700 bg-white border border-purple-200 px-1.5 py-0.5 rounded truncate max-w-[160px]">
                          {col.formulaExpression}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomColumn(col.id, col.name)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-100/60 px-2 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors"
                      title={`Delete "${col.name}" column`}
                    >
                      <Icon name="trash" className="w-3 h-3" />
                      Delete Column
                    </button>
                  </div>
                ))}

                {/* Standard Required: Amount */}
                <div className="p-2.5 px-3 flex items-center justify-between bg-gray-50/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-semibold text-gray-800">Amount (Qty × Rate)</span>
                    <span className="text-[10px] bg-gray-200/80 text-gray-700 px-1.5 py-0.5 rounded font-medium">Core Formula</span>
                  </div>
                  <span className="text-[11px] text-gray-400 italic">Always visible</span>
                </div>

                {/* Standard Column: GST Rate % */}
                {columnConfig.tax && (
                  <div className="p-2.5 px-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <input
                        type="text"
                        className="input py-0.5 px-2 text-xs font-medium w-36"
                        value={columnConfig.taxLabel}
                        onChange={(e) => setColumnConfig({ ...columnConfig, taxLabel: e.target.value })}
                        placeholder="GST Rate"
                        title="Rename column header"
                      />
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">Standard (%)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteStandardColumn('tax', columnConfig.taxLabel)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                      title="Delete GST Rate column"
                    >
                      <Icon name="trash" className="w-3 h-3" />
                      Delete Column
                    </button>
                  </div>
                )}

                {/* Standard Column: CGST / SGST Breakdown */}
                {columnConfig.cgstSgst && (
                  <div className="p-2.5 px-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      <span className="font-medium text-gray-800 w-44">CGST &amp; SGST (or IGST)</span>
                      <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">Tax Breakdown</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteStandardColumn('cgstSgst', 'CGST/SGST')}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                      title="Delete Tax Breakdown columns"
                    >
                      <Icon name="trash" className="w-3 h-3" />
                      Delete Column
                    </button>
                  </div>
                )}

                {/* Standard Required: Total */}
                <div className="p-2.5 px-3 flex items-center justify-between bg-gray-50/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span className="font-semibold text-gray-800">Line Total</span>
                    <span className="text-[10px] bg-gray-200/80 text-gray-700 px-1.5 py-0.5 rounded font-medium">Core Formula</span>
                  </div>
                  <span className="text-[11px] text-gray-400 italic">Always visible</span>
                </div>
              </div>
            </div>

            {/* Section 2: Restore Standard Columns (if any deleted) */}
            {(!columnConfig.hsn || !columnConfig.unit || !columnConfig.rate || !columnConfig.tax || !columnConfig.cgstSgst) && (
              <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3">
                <span className="font-bold text-amber-900 block mb-1.5 flex items-center gap-1">
                  <Icon name="plus" className="w-3.5 h-3.5" />
                  Restore Hidden / Deleted Standard Columns
                </span>
                <div className="flex flex-wrap gap-2">
                  {!columnConfig.hsn && (
                    <button
                      type="button"
                      onClick={() => handleRestoreStandardColumn('hsn', 'HSN/SAC')}
                      className="bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 shadow-xs"
                    >
                      <Icon name="plus" className="w-3 h-3 text-amber-700" />
                      + Add HSN/SAC Code
                    </button>
                  )}
                  {!columnConfig.unit && (
                    <button
                      type="button"
                      onClick={() => handleRestoreStandardColumn('unit', 'Unit')}
                      className="bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 shadow-xs"
                    >
                      <Icon name="plus" className="w-3 h-3 text-amber-700" />
                      + Add Unit Column
                    </button>
                  )}
                  {!columnConfig.rate && (
                    <button
                      type="button"
                      onClick={() => handleRestoreStandardColumn('rate', 'Rate')}
                      className="bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 shadow-xs"
                    >
                      <Icon name="plus" className="w-3 h-3 text-amber-700" />
                      + Add Rate Column
                    </button>
                  )}
                  {!columnConfig.tax && (
                    <button
                      type="button"
                      onClick={() => handleRestoreStandardColumn('tax', 'GST Rate')}
                      className="bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 shadow-xs"
                    >
                      <Icon name="plus" className="w-3 h-3 text-amber-700" />
                      + Add GST Rate Column
                    </button>
                  )}
                  {!columnConfig.cgstSgst && (
                    <button
                      type="button"
                      onClick={() => handleRestoreStandardColumn('cgstSgst', 'CGST/SGST')}
                      className="bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 shadow-xs"
                    >
                      <Icon name="plus" className="w-3 h-3 text-amber-700" />
                      + Add CGST/SGST Column
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Section 3: Add New Custom Column */}
            <div className="border border-purple-200 bg-purple-50/40 rounded-lg p-4">
              <span className="font-bold text-purple-950 text-sm block mb-1.5 flex items-center gap-1.5">
                <Icon name="plus" className="w-4 h-4 text-purple-700" />
                + Add New Column
              </span>
              <p className="text-[11px] text-gray-600 mb-3">
                Create a custom column for your line items table. Choose from Text, Number, Currency, or an automated Dynamic Mathematical Formula.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Column Name */}
                <div className="sm:col-span-5">
                  <label className="label text-[11px] font-bold text-gray-700">Column Title / Header *</label>
                  <input
                    type="text"
                    className="input py-1.5 text-xs font-medium"
                    placeholder="e.g. Discount %, Warranty, Batch #, MRP"
                    value={newColName}
                    onChange={(e) => setNewColName(e.target.value)}
                  />
                </div>

                {/* Column Type */}
                <div className="sm:col-span-4">
                  <label className="label text-[11px] font-bold text-gray-700">Column Data Type *</label>
                  <select
                    className="input py-1.5 text-xs font-semibold"
                    value={newColType}
                    onChange={(e) => {
                      const t = e.target.value as CustomColumnType;
                      setNewColType(t);
                      if (t === 'TEXT') setNewColAlign('left');
                      else setNewColAlign('right');
                    }}
                  >
                    <option value="TEXT">Text (Notes, Serial, Batch)</option>
                    <option value="NUMBER">Number (Quantity, %, Days)</option>
                    <option value="CURRENCY">Currency (Direct Amount)</option>
                    <option value="FORMULA">Dynamic Mathematical Formula</option>
                  </select>
                </div>

                {/* Alignment */}
                <div className="sm:col-span-3">
                  <label className="label text-[11px] font-bold text-gray-700">Alignment</label>
                  <select
                    className="input py-1.5 text-xs"
                    value={newColAlign}
                    onChange={(e) => setNewColAlign(e.target.value as any)}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Formula Options (if type === FORMULA) */}
              {newColType === 'FORMULA' && (
                <div className="mt-3 pt-3 border-t border-purple-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="label text-[11px] font-bold text-purple-900 mb-0">Formula Preset / Expression</label>
                    <span className="text-[10px] text-purple-700 font-medium">Computed live for each line row</span>
                  </div>

                  <select
                    className="input py-1.5 text-xs bg-white"
                    value={newColPreset}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewColPreset(val);
                      if (val !== 'CUSTOM') {
                        setNewColFormula(val);
                      }
                    }}
                  >
                    <option value="CUSTOM">Custom Mathematical Expression</option>
                    <option value="[amount] * 0.10">10% Discount Amount: [amount] * 0.10</option>
                    <option value="[amount] * 0.05">5% Trade Discount: [amount] * 0.05</option>
                    <option value="[rate] * 1.20">20% Markup Rate: [rate] * 1.20</option>
                    <option value="[rate] * ([tax] / 100)">GST Amount per Unit: [rate] * ([tax] / 100)</option>
                    <option value="[rate] * (1 + [tax] / 100)">Gross Price with GST: [rate] * (1 + [tax] / 100)</option>
                  </select>

                  {newColPreset === 'CUSTOM' && (
                    <div className="space-y-1.5 mt-2">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-gray-500 font-medium">Insert variable tokens:</span>
                        <button
                          type="button"
                          onClick={() => setNewColFormula((f) => f + ' [qty]')}
                          className="px-1.5 py-0.5 bg-white border border-purple-300 rounded font-mono text-purple-800 text-[10px] hover:bg-purple-100"
                        >
                          [qty]
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewColFormula((f) => f + ' [rate]')}
                          className="px-1.5 py-0.5 bg-white border border-purple-300 rounded font-mono text-purple-800 text-[10px] hover:bg-purple-100"
                        >
                          [rate]
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewColFormula((f) => f + ' [amount]')}
                          className="px-1.5 py-0.5 bg-white border border-purple-300 rounded font-mono text-purple-800 text-[10px] hover:bg-purple-100"
                        >
                          [amount]
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewColFormula((f) => f + ' [tax]')}
                          className="px-1.5 py-0.5 bg-white border border-purple-300 rounded font-mono text-purple-800 text-[10px] hover:bg-purple-100"
                        >
                          [tax]
                        </button>
                      </div>
                      <input
                        type="text"
                        className="input py-1.5 text-xs font-mono bg-white"
                        placeholder="e.g. [qty] * [rate] * 0.15"
                        value={newColFormula}
                        onChange={(e) => setNewColFormula(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleAddCustomColumn}
                  className="btn-primary py-1.5 px-4 text-xs font-bold bg-[#4C1D95] hover:bg-[#3B1F75] flex items-center gap-1.5 shadow-sm"
                >
                  <Icon name="plus" className="w-3.5 h-3.5" />
                  + Add Column to Table
                </button>
              </div>
            </div>

            {/* Section 4: Live Dynamic Formula Engine Summary */}
            <div className="border border-purple-200 bg-purple-50/50 p-3.5 rounded-lg space-y-1">
              <span className="font-bold text-purple-900 block mb-1 flex items-center gap-1.5">
                <span className="font-mono text-purple-700 font-black">∑</span>
                Dynamic Mathematical Formula Engine
              </span>
              <p className="text-[11px] text-purple-950 font-mono">
                • Line Amount = Quantity (NUMBER) × Rate (CURRENCY)
              </p>
              <p className="text-[11px] text-purple-950 font-mono">
                • GST Tax Breakdown = Line Amount × (GST Rate% / 100)
              </p>
              <p className="text-[11px] text-purple-950 font-mono">
                • Line Total = Line Amount + GST Tax
              </p>
              {customColumns.filter((c) => c.type === 'FORMULA').map((c) => (
                <p key={c.id} className="text-[11px] text-purple-950 font-mono">
                  • {c.name} = {c.formulaExpression}
                </p>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                className="btn-primary py-2 px-5 text-xs font-bold"
                onClick={() => setShowColumnsModal(false)}
              >
                Done &amp; Apply Changes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: Edit Business Profile (Quotation From)           */}
      {/* ========================================================= */}
      {showEditBusinessModal && (
        <Modal title="Edit Issuer Profile (Quotation From)" onClose={() => setShowEditBusinessModal(false)}>
          <div className="space-y-3 text-xs">
            <div>
              <label className="label">Business / Entity Name</label>
              <input
                type="text"
                className="input text-xs"
                value={settings?.businessName || ''}
                onChange={(e) => setSettings(settings ? { ...settings, businessName: e.target.value } : null)}
              />
            </div>
            <div>
              <label className="label">Address</label>
              <textarea
                rows={2}
                className="input text-xs"
                value={settings?.address || ''}
                onChange={(e) => setSettings(settings ? { ...settings, address: e.target.value } : null)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input text-xs"
                  value={settings?.email || ''}
                  onChange={(e) => setSettings(settings ? { ...settings, email: e.target.value } : null)}
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  type="text"
                  className="input text-xs"
                  value={settings?.phone || ''}
                  onChange={(e) => setSettings(settings ? { ...settings, phone: e.target.value } : null)}
                />
              </div>
            </div>
            <div>
              <label className="label">GSTIN</label>
              <input
                type="text"
                className="input text-xs font-mono uppercase"
                value={settings?.gstin || ''}
                onChange={(e) => setSettings(settings ? { ...settings, gstin: e.target.value } : null)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary py-1.5 px-3 text-xs font-semibold"
                onClick={() => setShowEditBusinessModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingBusinessProfile}
                className="btn-primary py-1.5 px-4 text-xs font-bold"
                onClick={handleSaveIssuerProfile}
              >
                {savingBusinessProfile ? 'Saving…' : 'Save & Update Profile'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: Add New Client                                   */}
      {/* ========================================================= */}
      {showClientModal && (
        <Modal title="Add New Client" onClose={() => setShowClientModal(false)}>
          <form onSubmit={handleCreateClient} className="space-y-3 text-xs">
            <div>
              <label className="label">Client / Business Name *</label>
              <input
                className="input"
                required
                autoFocus
                placeholder="Acme Studio Pvt Ltd"
                value={newClientForm.name}
                onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="billing@client.com"
                  value={newClientForm.email}
                  onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  className="input"
                  placeholder="+91 98765 43210"
                  value={newClientForm.phone}
                  onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Billing Address</label>
              <textarea
                rows={2}
                className="input"
                placeholder="Street address, city, state, postal code"
                value={newClientForm.billingAddress}
                onChange={(e) => setNewClientForm({ ...newClientForm, billingAddress: e.target.value })}
              />
            </div>
            <div>
              <label className="label">GSTIN (Optional)</label>
              <input
                className="input font-mono uppercase"
                placeholder="27ABCDE1234F1Z5"
                value={newClientForm.gstin}
                onChange={(e) => setNewClientForm({ ...newClientForm, gstin: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary py-1.5 px-3"
                onClick={() => setShowClientModal(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingClient}
                className="btn-primary py-1.5 px-4"
              >
                {savingClient ? 'Saving…' : 'Create & Select Client'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: Add Signature                                   */}
      {/* ========================================================= */}
      {showSignatureModal && (
        <Modal title="Add Authorized Signature" onClose={() => setShowSignatureModal(false)}>
          <div className="space-y-4 text-xs">
            <div>
              <label className="label">Signatory Name</label>
              <input
                type="text"
                className="input text-xs"
                placeholder="e.g. Navin R."
                value={signatureData.signatoryName}
                onChange={(e) => setSignatureData({ ...signatureData, signatoryName: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Designation / Title</label>
              <input
                type="text"
                className="input text-xs"
                placeholder="Authorized Signatory"
                value={signatureData.designation}
                onChange={(e) => setSignatureData({ ...signatureData, designation: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Upload Signature Image (PNG with transparent background)</label>
              <input
                type="file"
                accept="image/*"
                className="input text-xs mt-1"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => {
                      setSignatureData({ ...signatureData, imageUrl: ev.target?.result as string });
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                className="btn-primary py-1.5 px-4 text-xs font-bold"
                onClick={() => setShowSignatureModal(false)}
              >
                Save Signature
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
