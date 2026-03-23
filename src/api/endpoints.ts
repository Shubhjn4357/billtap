import { accountingRepository } from '../repositories/accountingRepository';
import { authRepository } from '../repositories/authRepository';
import { businessRepository } from '../repositories/businessRepository';
import { cashBankRepository } from '../repositories/cashBankRepository';
import { expenseRepository } from '../repositories/expenseRepository';
import { godownRepository } from '../repositories/godownRepository';
import { invoiceRepository } from '../repositories/invoiceRepository';
import { itemRepository } from '../repositories/itemRepository';
import { loanRepository } from '../repositories/loanRepository';
import { operationsRepository } from '../repositories/operationsRepository';
import { partyRepository } from '../repositories/partyRepository';
import { reportRepository } from '../repositories/reportRepository';
import { settingsRepository } from '../repositories/settingsRepository';
import { staffRepository } from '../repositories/staffRepository';
import { subscriptionRepository } from '../repositories/subscriptionRepository';

export type {
    InvoiceCreateInput,
    InvoiceListParams,
    InvoicePaymentInput,
    PosSaleCreateInput,
} from '../repositories/invoiceRepository';

// Compatibility facade only. App code should import repositories/hooks directly.
export const authApi = authRepository;
export const businessApi = businessRepository;
export const partyApi = partyRepository;
export const itemApi = itemRepository;
export const invoiceApi = {
    list: invoiceRepository.list,
    get: invoiceRepository.get,
    create: invoiceRepository.create,
    recordPayment: invoiceRepository.recordPayment,
    delete: invoiceRepository.delete,
};
export const expenseApi = expenseRepository;
export const loanApi = loanRepository;
export const godownApi = godownRepository;
export const cashBankApi = cashBankRepository;
export const staffApi = staffRepository;
export const operationsApi = operationsRepository;
export const settingsApi = settingsRepository;
export const reportApi = reportRepository;
export const accountingApi = {
    getAccounts: accountingRepository.getAccounts,
    createAccount: accountingRepository.createAccount,
    updateAccount: accountingRepository.updateAccount,
    deactivateAccount: accountingRepository.deactivateAccount,
    getTrialBalance: accountingRepository.getTrialBalance,
    getLedgers: accountingRepository.getLedgers,
    getLedger: accountingRepository.getLedger,
};
export const subscriptionApi = {
    get: subscriptionRepository.get,
    getPlans: subscriptionRepository.getPlans,
    createCheckoutSession: subscriptionRepository.createCheckoutSession,
    getIntentStatus: subscriptionRepository.getIntentStatus,
    validateDiscount: subscriptionRepository.validateDiscount,
    getActiveOffers: subscriptionRepository.getActiveOffers,
};
export const offerApi = {
    getActive: subscriptionRepository.getOfferList,
};
export const posApi = {
    createSale: invoiceRepository.createPosSale,
};
